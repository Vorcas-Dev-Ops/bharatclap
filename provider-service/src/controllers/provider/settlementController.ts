import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { ProviderSettlement } from '../../models/ProviderSettlement';
import { WalletTransaction } from '../../models/WalletTransaction';

import { LedgerEntry } from '../../models/LedgerEntry';
import { ProviderStats } from '../../models/ProviderStats';
import { recordWalletChangeAndAudit } from '../../services/walletLedgerService';

// @desc    Internal API to create provider settlement upon job completion
// @route   POST /api/providers/internal/settlements/create
// @access  Internal
export const createInternalSettlement = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { provider_id, booking_id, booking_display_id, payment_type, payable_amount, commission_percentage } = req.body;

    // Check if duplicate settlement exists
    const duplicate = await ProviderSettlement.findOne({ booking_id }).session(session);
    if (duplicate) {
      res.status(409).json({ message: 'Settlement already exists for this booking' });
      await session.abortTransaction();
      session.endSession();
      return;
    }

    const provider = await Provider.findById(provider_id).session(session);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      await session.abortTransaction();
      session.endSession();
      return;
    }

    // Calculations (Hierarchical Rate Override check)
    const gross_amount = Number(payable_amount);
    const comm_pct = Number(commission_percentage || 20);
    const commission_amount = (gross_amount * comm_pct) / 100;
    const gst_on_commission = commission_amount * 0.18;
    const tds_amount = gross_amount * 0.01;
    const tcs_amount = gross_amount * 0.01;

    let net_payable_amount = 0;
    let cod_due_amount = 0;
    let status: 'pending_hold' | 'cod_pending';
    let hold_ends_at: Date | undefined;
    let cod_due_by: Date | undefined;

    if (payment_type === 'online') {
      net_payable_amount = gross_amount - commission_amount - gst_on_commission - tds_amount - tcs_amount;
      status = 'pending_hold';
      hold_ends_at = new Date();
      hold_ends_at.setDate(hold_ends_at.getDate() + 3); // 3-day hold window
    } else {
      cod_due_amount = commission_amount + gst_on_commission;
      status = 'cod_pending';
      cod_due_by = new Date();
      cod_due_by.setDate(cod_due_by.getDate() + 3); // Must remit within 3 days

      // Update provider outstanding COD balance
      provider.codDueBalance = (provider.codDueBalance || 0) + cod_due_amount;
      if (provider.codDueBalance > 2000) {
        provider.isDispatchBlockedByCod = true;
      }
      await provider.save({ session });
    }

    const settlementDocs = await ProviderSettlement.create([{
      provider_id: provider._id,
      booking_id,
      booking_display_id,
      payment_type,
      gross_amount,
      commission_amount,
      gst_on_commission,
      tds_amount,
      tcs_amount,
      net_payable_amount,
      cod_due_amount,
      status,
      hold_ends_at,
      cod_due_by
    }], { session });
    const settlement = settlementDocs[0];

    // Double-Entry Financial Ledger Entries (Auditability)
    const now = new Date();
    const batchId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await LedgerEntry.create([
      {
        entry_id: `LEDGER_PAY_${batchId}_1`,
        provider_id: provider._id,
        booking_id,
        settlement_id: settlement._id,
        transaction_type: 'customer_payment',
        debit_account: 'CUSTOMER_ESCROW',
        credit_account: 'PLATFORM_ESCROW',
        amount: gross_amount,
        reference_id: booking_display_id,
        description: `Customer payment received for booking ${booking_display_id}`,
      },
      {
        entry_id: `LEDGER_COMM_${batchId}_2`,
        provider_id: provider._id,
        booking_id,
        settlement_id: settlement._id,
        transaction_type: 'commission_fee',
        debit_account: 'PLATFORM_ESCROW',
        credit_account: 'PLATFORM_COMMISSION_REVENUE',
        amount: commission_amount,
        reference_id: booking_display_id,
        description: `Platform commission fee (${comm_pct}%) for booking ${booking_display_id}`,
      },
      {
        entry_id: `LEDGER_GST_${batchId}_3`,
        provider_id: provider._id,
        booking_id,
        settlement_id: settlement._id,
        transaction_type: 'gst_tax',
        debit_account: 'PLATFORM_ESCROW',
        credit_account: 'GOVT_GST_PAYABLE',
        amount: gst_on_commission,
        reference_id: booking_display_id,
        description: `18% GST on platform commission for booking ${booking_display_id}`,
      },
    ], { session });

    // Incremental Provider Performance Analytics Update (Avoids dynamic aggregation)
    const todayStr = now.toISOString().split('T')[0];
    let stats = await ProviderStats.findOne({ provider_id: provider._id }).session(session);
    if (!stats) {
      stats = new ProviderStats({ provider_id: provider._id });
    }

    if (stats.lastUpdatedDate !== todayStr) {
      stats.todayOrders = 0;
      stats.todayRevenue = 0;
      stats.lastUpdatedDate = todayStr;
    }

    stats.todayOrders += 1;
    stats.weekOrders += 1;
    stats.monthOrders += 1;
    stats.yearOrders += 1;
    stats.totalCompletedOrders += 1;
    stats.todayRevenue += net_payable_amount;
    stats.monthRevenue += net_payable_amount;
    stats.totalRevenue += net_payable_amount;

    await stats.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Settlement created successfully', settlement });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update provider bank account details
// @route   POST /api/providers/bank-details
// @access  Private/Provider
export const updateBankDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;
    
    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      res.status(400).json({ message: 'All bank details fields (accountHolderName, accountNumber, ifscCode, bankName) are required' });
      return;
    }

    const cleanAccount = String(accountNumber).trim();
    const cleanIfsc = String(ifscCode).trim().toUpperCase();
    const cleanHolder = String(accountHolderName).trim();
    const cleanBank = String(bankName).trim();

    if (!/^\d{8,18}$/.test(cleanAccount)) {
      res.status(400).json({ message: 'Invalid account number format. Must be between 8 and 18 digits.' });
      return;
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      res.status(400).json({ message: 'Invalid IFSC code format (e.g. SBIN0001234).' });
      return;
    }

    if (cleanHolder.length < 2 || cleanHolder.length > 100) {
      res.status(400).json({ message: 'Account holder name must be between 2 and 100 characters.' });
      return;
    }

    if (cleanBank.length < 2 || cleanBank.length > 100) {
      res.status(400).json({ message: 'Bank name must be between 2 and 100 characters.' });
      return;
    }

    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    provider.bankDetails = {
      accountHolderName: cleanHolder,
      accountNumber: cleanAccount,
      ifscCode: cleanIfsc,
      bankName: cleanBank,
      status: 'verified' // Auto-verified for mock sandbox PG simulation
    };
    await provider.save();

    res.json({ message: 'Bank details updated successfully', bankDetails: provider.bankDetails });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get provider earnings summary and payout list
// @route   GET /api/providers/earnings-payouts
// @access  Private/Provider
export const getEarningsPayouts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const settlements = await ProviderSettlement.find({ provider_id: provider._id })
      .sort({ createdAt: -1 })
      .lean() as any[];

    // Available Earnings (Ready for payout)
    const availableEarnings = settlements
      .filter(s => s.status === 'ready_for_payout' && s.payment_type === 'online')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    // Pending Settlement (Hold)
    const pendingSettlement = settlements
      .filter(s => s.status === 'pending_hold' && s.payment_type === 'online')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    // Total Paid
    const totalPaid = settlements
      .filter(s => s.status === 'paid' && s.payment_type === 'online')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    // Next Payout Date (earliest hold release date)
    const earliestHold = settlements
      .filter(s => s.status === 'pending_hold' && s.payment_type === 'online' && s.hold_ends_at)
      .map(s => new Date(s.hold_ends_at))
      .sort((a, b) => a.getTime() - b.getTime())[0] || null;

    res.json({
      availableEarnings,
      pendingSettlement,
      nextPayoutDate: earliestHold,
      totalPaid,
      codDues: provider.codDueBalance || 0,
      bankStatus: provider.bankDetails?.status || 'not_configured',
      settlementHistory: settlements
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remit outstanding COD dues using available wallet balance
// @route   POST /api/providers/wallet/remit-cod
// @access  Private/Provider
export const remitCodDues = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      res.status(400).json({ message: 'Invalid payment amount' });
      return;
    }

    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    if (provider.availableCredit < amount) {
      res.status(400).json({ message: 'Insufficient wallet available credit to pay COD dues' });
      return;
    }

    // Process remittance via ledger service (atomic: updates walletBalance + creates WalletTransaction + WalletAuditLog)
    await recordWalletChangeAndAudit({
      providerId: provider._id,
      amount,
      type: 'deduction',
      action: 'COD Remittance',
      source: 'System',
      reason: 'COD due remittance payout to platform',
      referenceId: `cod_remit_${provider._id}_${Date.now()}`,
    });
    // Re-read updated provider so codDueBalance update is applied
    provider.codDueBalance = Math.max(0, provider.codDueBalance - amount);
    if (provider.codDueBalance <= 2000) {
      provider.isDispatchBlockedByCod = false;
    }
    await provider.save();

    // Also reconcile/update status of individual COD settlements
    let remainingToDeduct = amount;
    const pendingCodSettlements = await ProviderSettlement.find({
      provider_id: provider._id,
      payment_type: 'cod',
      status: 'cod_pending'
    }).sort({ createdAt: 1 });

    for (const s of pendingCodSettlements) {
      if (remainingToDeduct <= 0) break;
      if (s.cod_due_amount <= remainingToDeduct) {
        remainingToDeduct -= s.cod_due_amount;
        s.status = 'cod_settled';
        await s.save();
      } else {
        s.cod_due_amount -= remainingToDeduct;
        remainingToDeduct = 0;
        await s.save();
      }
    }

    res.json({
      message: 'COD dues remitted successfully',
      walletBalance: provider.walletBalance,
      codDueBalance: provider.codDueBalance
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get admin settlements stats & listing
// @route   GET /api/providers/admin/settlements
// @access  Private/Admin
export const getAdminSettlements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settlements = await ProviderSettlement.find({})
      .populate({ path: 'provider_id', select: 'bankDetails user_id codDueBalance walletBalance reservedBalance creditLimit availableCredit' })
      .sort({ createdAt: -1 })
      .lean() as any[];

    // Aggregated Stats
    const totalPendingHold = settlements
      .filter(s => s.status === 'pending_hold')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    const totalReadyForPayout = settlements
      .filter(s => s.status === 'ready_for_payout')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    const totalPaid = settlements
      .filter(s => s.status === 'paid')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    const totalCodOutstanding = settlements
      .filter(s => s.status === 'cod_pending')
      .reduce((sum, s) => sum + s.cod_due_amount, 0);

    const overdueCod = settlements
      .filter(s => s.status === 'cod_pending' && s.cod_due_by && new Date(s.cod_due_by) < new Date())
      .reduce((sum, s) => sum + s.cod_due_amount, 0);

    const failedPayouts = settlements
      .filter(s => s.status === 'failed')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    res.json({
      stats: {
        totalPendingHold,
        totalReadyForPayout,
        totalPaid,
        totalCodOutstanding,
        overdueCod,
        failedPayouts
      },
      settlements
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin action override on settlements (approve/hold/retry)
// @route   POST /api/providers/admin/settlements/:id/action
// @access  Private/Admin
export const processSettlementAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action } = req.body; // 'approve' | 'hold' | 'retry'
    const settlement = await ProviderSettlement.findById(req.params.id);
    if (!settlement) {
      res.status(404).json({ message: 'Settlement record not found' });
      return;
    }

    if (action === 'approve') {
      settlement.status = 'ready_for_payout';
    } else if (action === 'hold') {
      settlement.status = 'held_by_admin';
    } else if (action === 'retry') {
      settlement.status = 'ready_for_payout';
      settlement.failure_reason = undefined;
      settlement.payout_attempts = 0;
    } else {
      res.status(400).json({ message: 'Invalid settlement action' });
      return;
    }

    await settlement.save();
    res.json({ message: `Settlement action '${action}' applied successfully`, settlement });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get precomputed provider performance analytics (Today/Week/Month/Year + Rates)
// @route   GET /api/providers/dashboard-analytics
// @access  Private/Provider
export const getProviderDashboardAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    let stats = await ProviderStats.findOne({ provider_id: provider._id }).lean();
    if (!stats) {
      stats = {
        provider_id: provider._id,
        todayOrders: 0,
        weekOrders: 0,
        monthOrders: 0,
        yearOrders: 0,
        totalCompletedOrders: (provider as any).completed_jobs || 0,
        totalCancelledOrders: 0,
        todayRevenue: 0,
        monthRevenue: 0,
        totalRevenue: 0,
        acceptanceRate: 100,
        completionRate: 100,
        lastUpdatedDate: new Date().toISOString().split('T')[0],
      } as any;
    }

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin execution of payout release (Automated / Manual Payout Trigger with Concurrency Lock)
// @route   POST /api/providers/admin/settlements/:id/release-payout
// @access  Private/Admin
export const releaseSettlementPayoutAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { utr_number, bank_reference_number, notes } = req.body;

    // Atomic Concurrency Lock: Ensure no two admins can release simultaneously
    const settlement = await ProviderSettlement.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'paid' }, is_locked: false },
      { $set: { is_locked: true, status: 'processing' } },
      { new: true }
    );

    if (!settlement) {
      res.status(409).json({ message: 'Settlement is currently locked in flight or already paid out.' });
      return;
    }

    const payoutRef = `PO_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const generatedUtr = utr_number || `UTR${Date.now()}${Math.floor(Math.random() * 1000)}`;

    settlement.status = 'paid';
    settlement.is_locked = false;
    settlement.paid_at = new Date();
    settlement.payout_reference_id = payoutRef;
    settlement.utr_number = generatedUtr;
    settlement.bank_reference_number = bank_reference_number || `BANK_REF_${Date.now()}`;
    settlement.audit_trail.push({
      action: 'payout_released',
      performed_by: req.user?._id || 'admin',
      timestamp: new Date(),
      notes: notes || `Payout released with UTR ${generatedUtr}`,
    });

    await settlement.save();

    // Create payout ledger entry
    await LedgerEntry.create({
      entry_id: `LEDGER_PO_${payoutRef}`,
      provider_id: settlement.provider_id,
      booking_id: settlement.booking_id,
      settlement_id: settlement._id,
      transaction_type: 'provider_payout',
      debit_account: 'PROVIDER_PAYABLE_ACCOUNT',
      credit_account: 'BANK_PAYOUT_GATEWAY',
      amount: settlement.net_payable_amount,
      reference_id: payoutRef,
      description: `Bank payout released (UTR: ${generatedUtr}) for booking ${settlement.booking_display_id}`,
    });

    res.json({ message: 'Payout released successfully', payoutRef, utr_number: generatedUtr, settlement });
  } catch (error: any) {
    // Unlock if error occurs
    await ProviderSettlement.findByIdAndUpdate(req.params.id, { $set: { is_locked: false } });
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin creation of manual ledger adjustments (Bonus, Penalty, Fuel, Festival)
// @route   POST /api/providers/admin/adjustments
// @access  Private/Admin
export const createManualAdjustmentAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { provider_id, type, amount, reason } = req.body; // type: 'bonus' | 'penalty' | 'fuel_allowance' | 'compensation'

    if (!provider_id || !amount || amount <= 0 || !reason) {
      res.status(400).json({ message: 'Provider ID, positive amount, and reason are required' });
      return;
    }

    const provider = await Provider.findById(provider_id);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const isCredit = ['bonus', 'fuel_allowance', 'compensation'].includes(type);
    const adjustmentAmount = Number(amount);
    const adjRef = `ADJ_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Route through ledger service — atomic write + WalletTransaction + WalletAuditLog
    await recordWalletChangeAndAudit({
      providerId: provider._id,
      amount: adjustmentAmount,
      type: isCredit ? 'credit' : 'debit',
      action: `Admin Manual Adjustment (${type.toUpperCase()})`,
      source: 'Admin',
      reason,
      remarks: `Type: ${type}`,
      adminUser: (req as AuthRequest).user,
      referenceId: adjRef,
    });

    await LedgerEntry.create({
      entry_id: `LEDGER_ADJ_${adjRef}`,
      provider_id: provider._id,
      transaction_type: isCredit ? 'customer_payment' : 'commission_fee',
      debit_account: isCredit ? 'PLATFORM_RESERVE' : 'PROVIDER_WALLET',
      credit_account: isCredit ? 'PROVIDER_WALLET' : 'PLATFORM_REVENUE',
      amount: adjustmentAmount,
      reference_id: adjRef,
      description: `Admin manual adjustment (${type.toUpperCase()}): ${reason}`,
    });

    const updatedProvider = await Provider.findById(provider._id).select('walletBalance');
    res.status(201).json({
      message: `Manual adjustment '${type}' of ₹${adjustmentAmount} recorded successfully`,
      walletBalance: updatedProvider?.walletBalance,
      reference: adjRef,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
