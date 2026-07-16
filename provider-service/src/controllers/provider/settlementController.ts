import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { ProviderSettlement } from '../../models/ProviderSettlement';
import { WalletTransaction } from '../../models/WalletTransaction';

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

    // Calculations
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

    const settlement = await ProviderSettlement.create([{
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

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Settlement created successfully', settlement: settlement[0] });
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
      res.status(400).json({ message: 'All bank details fields are required' });
      return;
    }

    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    provider.bankDetails = {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
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

    // Process remittance
    provider.walletBalance -= amount;
    provider.codDueBalance = Math.max(0, provider.codDueBalance - amount);

    // Check if dispatch blocked flag can be cleared
    if (provider.codDueBalance <= 2000) {
      provider.isDispatchBlockedByCod = false;
    }

    await provider.save();

    // Log transaction
    await WalletTransaction.create({
      provider_id: provider._id,
      type: 'deduction',
      amount,
      balanceAfter: provider.walletBalance - provider.reservedBalance,
      referenceId: 'cod_remit_' + Date.now(),
      description: `COD due remittance payout to platform`,
      status: 'success'
    });

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
