import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { ProviderSettlement } from '../../models/ProviderSettlement';
import { WalletTransaction } from '../../models/WalletTransaction';

import { LedgerEntry } from '../../models/LedgerEntry';
import { ProviderStats } from '../../models/ProviderStats';
import { DispatchSetting } from '../../models/DispatchSetting';
import { recordWalletChangeAndAudit } from '../../services/walletLedgerService';
import { getUsersBatch } from '../../utils/internalApi';
import { razorpayXService, classifyFailure } from '../../services/razorpayXService';
import { batchProcessSettlements, processSingleSettlementPayout } from '../../services/batchSettlementProcessor';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// @desc    Internal API to create provider settlement upon job completion
// @route   POST /api/providers/internal/settlements/create
// @access  Internal
export const createInternalSettlement = async (req: Request, res: Response): Promise<void> => {
  let session: mongoose.ClientSession | null = null;
  try {
    const { provider_id, booking_id, booking_display_id, payment_type, payable_amount, commission_percentage, service_name, variant_name } = req.body;

    // 1. Check if duplicate settlement exists
    const duplicate = await ProviderSettlement.findOne({ booking_id }).lean();
    if (duplicate) {
      res.status(409).json({ message: 'Settlement already exists for this booking' });
      return;
    }

    // 2. Multi-stage provider lookup: matches _id, user_id, or provider_code across Mongoose module instances
    const providerIdStr = String(provider_id || '').trim();
    let provider: any = null;

    if (mongoose.Types.ObjectId.isValid(providerIdStr)) {
      try {
        const objId = new mongoose.Types.ObjectId(providerIdStr);
        provider = await Provider.findOne({
          $or: [
            { _id: objId },
            { user_id: objId },
            { _id: providerIdStr as any },
            { user_id: providerIdStr as any }
          ]
        });
      } catch (e) {
        provider = await Provider.findOne({
          $or: [
            { _id: providerIdStr as any },
            { user_id: providerIdStr as any }
          ]
        });
      }
    }

    if (!provider) {
      provider = await Provider.findOne({ provider_code: providerIdStr });
    }

    if (!provider) {
      res.status(404).json({ message: `Provider not found for ID/Code: ${provider_id}` });
      return;
    }

    session = await mongoose.startSession();
    session.startTransaction();

    // Load configurable finance rates (ponytail: one query, defaults baked in schema)
    const cfg = await DispatchSetting.findOne().lean() || {} as any;
    const gstPct = cfg.gstRateOnCommission ?? 18;
    const tdsPct = cfg.tdsRateOnGross ?? 1;
    const tcsPct = cfg.tcsRateOnGross ?? 1;
    const holdDays = cfg.settlementHoldDays ?? 3;
    const codRemitDays = cfg.codRemitDays ?? 3;
    const codThreshold = cfg.codBlockThreshold ?? 2000;
    const defaultCommPct = cfg.defaultCommissionPercentage ?? 20;

    // Calculations
    const gross_amount = Number(payable_amount);
    const comm_pct = Number(commission_percentage || defaultCommPct);
    const commission_amount = (gross_amount * comm_pct) / 100;
    const gst_on_commission = commission_amount * gstPct / 100;
    const tds_amount = gross_amount * tdsPct / 100;
    const tcs_amount = gross_amount * tcsPct / 100;

    let net_payable_amount = 0;
    let cod_due_amount = 0;
    let status: 'pending_hold' | 'cod_pending';
    let hold_ends_at: Date | undefined;
    let cod_due_by: Date | undefined;

    if (payment_type === 'online') {
      net_payable_amount = gross_amount - commission_amount - gst_on_commission - tds_amount - tcs_amount;
      status = 'pending_hold';
      hold_ends_at = new Date();
      hold_ends_at.setDate(hold_ends_at.getDate() + holdDays);
    } else {
      cod_due_amount = commission_amount + gst_on_commission;
      status = 'cod_pending';
      cod_due_by = new Date();
      cod_due_by.setDate(cod_due_by.getDate() + codRemitDays);

      // Update provider outstanding COD balance
      provider.codDueBalance = (provider.codDueBalance || 0) + cod_due_amount;
      if (provider.codDueBalance > codThreshold) {
        provider.isDispatchBlockedByCod = true;
      }
      await provider.save({ session });
    }

    const settlementDocs = await ProviderSettlement.create([{
      provider_id: provider._id,
      booking_id,
      booking_display_id,
      service_name: service_name || req.body.service_title || 'Home Service',
      variant_name: variant_name || req.body.service_variant,
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
      cod_due_by,
      // ponytail: audit_trail schema already exists — just use it
      audit_trail: [{
        action: 'SETTLEMENT_CREATED',
        performed_by: 'system',
        timestamp: new Date(),
        notes: `${payment_type.toUpperCase()} settlement: gross ₹${gross_amount}, commission ₹${commission_amount.toFixed(2)}, net ₹${net_payable_amount.toFixed(2)}`,
      }],
    }], { session, ordered: true });
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
    ], { session, ordered: true });

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

    const net_earnings = gross_amount - commission_amount - gst_on_commission - tds_amount - tcs_amount;

    stats.todayOrders += 1;
    stats.weekOrders += 1;
    stats.monthOrders += 1;
    stats.yearOrders += 1;
    stats.totalCompletedOrders += 1;
    stats.todayRevenue += net_earnings;
    stats.monthRevenue += net_earnings;
    stats.totalRevenue += net_earnings;

    await stats.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Settlement created successfully', settlement });
  } catch (error: any) {
    if (session) {
      try { await session.abortTransaction(); } catch (e) {}
      session.endSession();
    }
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

    const bankObj = {
      accountHolderName: cleanHolder,
      accountNumber: cleanAccount,
      ifscCode: cleanIfsc,
      bankName: cleanBank,
      status: 'verified' as const,
    };

    // RazorpayX Onboarding Integration
    let contactId = provider.razorpay_contact_id;
    if (!contactId) {
      const contactRes = await razorpayXService.createContact({ ...provider.toObject(), bankDetails: bankObj });
      contactId = contactRes.id;
    }

    const fundAccountRes = await razorpayXService.createFundAccount(contactId, bankObj);
    const validationRes = await razorpayXService.validateFundAccount(fundAccountRes.id);

    provider.bankDetails = { ...bankObj, status: 'pending' };
    provider.razorpay_contact_id = contactId;
    provider.razorpay_fund_account_id = fundAccountRes.id;
    provider.fund_account_validation_id = validationRes.id;
    provider.razorpay_account_status = 'UNDER_REVIEW';
    // bank_verified_at set only when fund_account.validation.completed webhook confirms
    provider.bank_last_4 = cleanAccount.slice(-4);

    await provider.save();

    res.json({
      message: 'Bank details submitted, verification pending',
      status: 'pending',
      razorpay_contact_id: provider.razorpay_contact_id,
      razorpay_fund_account_id: provider.razorpay_fund_account_id,
    });
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
    const { amount, paymentMethod } = req.body;
    
    if (!amount || amount <= 0) {
      res.status(400).json({ message: 'Invalid payment amount' });
      return;
    }

    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const remitAmount = Math.min(amount, provider.codDueBalance || amount);

    // If paymentMethod is explicitly 'wallet' or provider has sufficient wallet credit:
    if ((paymentMethod === 'wallet' || !paymentMethod) && provider.availableCredit >= remitAmount) {
      await recordWalletChangeAndAudit({
        providerId: provider._id,
        amount: remitAmount,
        type: 'deduction',
        action: 'COD Remittance',
        source: 'System',
        reason: 'COD due remittance payout to platform',
        referenceId: `cod_remit_${provider._id}_${Date.now()}`,
      });

      provider.codDueBalance = Math.max(0, (provider.codDueBalance || 0) - remitAmount);
      const cfg = await DispatchSetting.findOne().lean() || {} as any;
      if (provider.codDueBalance <= (cfg.codBlockThreshold ?? 2000)) {
        provider.isDispatchBlockedByCod = false;
      }
      await provider.save();

      let remainingToDeduct = remitAmount;
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
          s.audit_trail.push({ action: 'COD_REMITTED_WALLET', performed_by: 'provider', timestamp: new Date(), notes: `Wallet credit deduction` });
          await s.save();
        } else {
          s.cod_due_amount -= remainingToDeduct;
          s.audit_trail.push({ action: 'COD_PARTIAL_REMIT_WALLET', performed_by: 'provider', timestamp: new Date(), notes: `Partial: ₹${remainingToDeduct}` });
          remainingToDeduct = 0;
          await s.save();
        }
      }

      res.json({
        success: true,
        method: 'wallet',
        message: 'COD dues remitted successfully using wallet credit',
        walletBalance: provider.walletBalance,
        codDueBalance: provider.codDueBalance
      });
      return;
    }

    // Fallback/Online Payment via Razorpay PG modal if insufficient wallet credit or method='online'
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret12345';

    let rzpOrder;
    if (key_id.includes('dummy') || key_id.includes('mock') || process.env.NODE_ENV === 'development') {
      rzpOrder = {
        id: `order_mock_cod_remit_${Date.now()}`,
        amount: Math.round(remitAmount * 100),
        currency: 'INR',
        receipt: `cod_remit_${Date.now()}`
      };
    } else {
      const razorpay = new Razorpay({ key_id, key_secret });
      rzpOrder = await razorpay.orders.create({
        amount: Math.round(remitAmount * 100),
        currency: 'INR',
        receipt: `cod_remit_${Date.now()}`,
        notes: {
          provider_id: String(provider._id),
          purpose: 'COD_REMITTANCE',
          amount: String(remitAmount)
        }
      });
    }

    res.json({
      success: true,
      method: 'online',
      message: 'Razorpay order created for COD remittance online payment',
      razorpayOrder: rzpOrder,
      key_id,
      amount: remitAmount,
      codDueBalance: provider.codDueBalance
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify online Razorpay payment for COD remittance
// @route   POST /api/providers/wallet/remit-cod/verify
// @access  Private/Provider
export const verifyCodRemittancePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const isMock = razorpay_order_id?.startsWith('order_mock_');
    if (!isMock && razorpay_signature) {
      const secret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret12345';
      const generated_signature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        res.status(400).json({ message: 'Invalid payment signature' });
        return;
      }
    }

    const payAmount = Number(amount) || provider.codDueBalance || 0;
    const paymentRef = razorpay_payment_id || `pay_mock_cod_${Date.now()}`;

    provider.codDueBalance = Math.max(0, (provider.codDueBalance || 0) - payAmount);
    const cfg = await DispatchSetting.findOne().lean() || {} as any;
    if (provider.codDueBalance <= (cfg.codBlockThreshold ?? 2000)) {
      provider.isDispatchBlockedByCod = false;
    }
    await provider.save();

    let remainingToDeduct = payAmount;
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
        s.audit_trail.push({ action: 'COD_REMITTED_ONLINE', performed_by: 'provider', timestamp: new Date(), notes: `Online Razorpay payment` });
        await s.save();
      } else {
        s.cod_due_amount -= remainingToDeduct;
        s.audit_trail.push({ action: 'COD_PARTIAL_REMIT_ONLINE', performed_by: 'provider', timestamp: new Date(), notes: `Partial online: ₹${remainingToDeduct}` });
        remainingToDeduct = 0;
        await s.save();
      }
    }

    await LedgerEntry.create({
      entry_id: `LEDGER_COD_ONLINE_${Date.now()}`,
      provider_id: provider._id,
      transaction_type: 'customer_payment',
      debit_account: 'RAZORPAY_GATEWAY',
      credit_account: 'PLATFORM_REVENUE',
      amount: payAmount,
      reference_id: paymentRef,
      description: `Online COD dues remittance via Razorpay (Pay ID: ${paymentRef})`,
    }).catch(() => {});

    res.json({
      success: true,
      message: 'COD dues remitted successfully via online payment!',
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
      .populate({ path: 'provider_id', select: 'bankDetails user_id codDueBalance walletBalance reservedBalance creditLimit availableCredit businessName provider_code' })
      .sort({ createdAt: -1 })
      .lean() as any[];

    // Fetch user details in batch from auth-service
    const userIds = Array.from(new Set(settlements.map(s => s.provider_id?.user_id).filter(Boolean)));
    const users = userIds.length ? await getUsersBatch(userIds) : [];
    const userMap = new Map<string, any>();
    for (const u of users) {
      if (u && u._id) userMap.set(String(u._id), u);
    }

    for (const s of settlements) {
      if (s.provider_id && typeof s.provider_id === 'object') {
        const u = userMap.get(String(s.provider_id.user_id));
        s.provider_id.name = u?.name || u?.full_name || s.provider_id.bankDetails?.accountHolderName || (s.provider_id.provider_code ? `Provider ${s.provider_id.provider_code}` : '');
        s.provider_id.email = u?.email || '';
        s.provider_id.phone = u?.phone || u?.mobile || '';
      }
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
      .filter(s => s.status === 'cod_pending' && s.cod_due_by && new Date(s.cod_due_by) < now)
      .reduce((sum, s) => sum + s.cod_due_amount, 0);

    const failedPayouts = settlements
      .filter(s => s.status === 'failed')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    // ponytail: today's revenue breakdown from existing data, no extra DB query
    const todaySettlements = settlements.filter(s => new Date(s.createdAt) >= todayStart);
    const todayRevenue = todaySettlements.reduce((sum, s) => sum + (s.commission_amount || 0) + (s.gst_on_commission || 0), 0);
    const todayOnlineRevenue = todaySettlements.filter(s => s.payment_type === 'online').reduce((sum, s) => sum + (s.commission_amount || 0) + (s.gst_on_commission || 0), 0);
    const todayCodRevenue = todaySettlements.filter(s => s.payment_type === 'cod').reduce((sum, s) => sum + (s.commission_amount || 0) + (s.gst_on_commission || 0), 0);

    // Per-provider finance summary table
    const providerMap = new Map<string, any>();
    for (const s of settlements) {
      const pid = String(s.provider_id?._id || s.provider_id);
      const provName = s.provider_id?.name || s.provider_id?.bankDetails?.accountHolderName || (s.provider_id?.provider_code ? `Provider ${s.provider_id.provider_code}` : `Provider ${pid.slice(-6)}`);
      const entry = providerMap.get(pid) || {
        providerId: pid,
        providerCode: s.provider_id?.provider_code || pid.slice(-8).toUpperCase(),
        providerName: provName,
        completedJobs: 0, onlineJobs: 0, codJobs: 0,
        totalEarnings: 0, codCollected: 0, codDeposited: 0, outstandingCod: 0,
        pendingSettlements: 0, walletBalance: s.provider_id?.walletBalance || 0,
        lastDepositDate: null, status: 'active',
      };
      entry.completedJobs++;
      if (s.payment_type === 'online') entry.onlineJobs++;
      else entry.codJobs++;
      entry.totalEarnings += s.gross_amount || 0;
      if (s.payment_type === 'cod') {
        entry.codCollected += s.gross_amount || 0;
        if (s.status === 'cod_settled') entry.codDeposited += s.cod_due_amount || 0;
        if (s.status === 'cod_pending') entry.outstandingCod += s.cod_due_amount || 0;
      }
      if (['pending_hold', 'ready_for_payout', 'processing'].includes(s.status)) entry.pendingSettlements++;
      if (s.status === 'cod_settled' && s.updatedAt) {
        const d = new Date(s.updatedAt);
        if (!entry.lastDepositDate || d > new Date(entry.lastDepositDate)) entry.lastDepositDate = s.updatedAt;
      }
      providerMap.set(pid, entry);
    }
    const providerFinanceTable = Array.from(providerMap.values()).sort((a, b) => b.outstandingCod - a.outstandingCod);

    // COD Ageing buckets
    const codPending = settlements.filter(s => s.status === 'cod_pending');
    const codAgeing = { '0-2d': 0, '3-5d': 0, '6-10d': 0, '10d+': 0 };
    for (const s of codPending) {
      const ageDays = Math.floor((now.getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays <= 2) codAgeing['0-2d'] += s.cod_due_amount || 0;
      else if (ageDays <= 5) codAgeing['3-5d'] += s.cod_due_amount || 0;
      else if (ageDays <= 10) codAgeing['6-10d'] += s.cod_due_amount || 0;
      else codAgeing['10d+'] += s.cod_due_amount || 0;
    }

    // Providers with pending COD count
    const providersWithPendingCod = new Set(codPending.map(s => String(s.provider_id?._id || s.provider_id))).size;

    res.json({
      stats: {
        totalPendingHold,
        totalReadyForPayout,
        totalPaid,
        totalCodOutstanding,
        overdueCod,
        failedPayouts,
        todayRevenue,
        todayOnlineRevenue,
        todayCodRevenue,
        todayJobs: todaySettlements.length,
        providersWithPendingCod,
        codAgeing,
      },
      providerFinanceTable,
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
      // Block approve if the settlement was marked non-retryable — admin must use 'retry' to explicitly override
      if (settlement.is_non_retryable) {
        res.status(400).json({
          message: 'Settlement is non-retryable. Use action \'retry\' to explicitly override and reset attempt counter.',
        });
        return;
      }
      settlement.status = 'ready_for_payout';
    } else if (action === 'hold') {
      settlement.status = 'held_by_admin';
    } else if (action === 'retry') {
      // Explicit admin override: clears non-retryable flag so the settlement re-enters the queue.
      // payout_attempts is NOT reset — the counter stays monotonically increasing so each
      // RazorpayX call gets a fresh idempotency key (:payout:N+1) that RazorpayX has never seen.
      settlement.status = 'ready_for_payout';
      settlement.failure_reason = undefined;
      settlement.is_non_retryable = false;
    } else {
      res.status(400).json({ message: 'Invalid settlement action' });
      return;
    }

    const auditNote = action === 'retry'
      ? `Admin override: forced retry, cleared non-retryable flag (attempt counter preserved for key uniqueness)`
      : `Admin action: ${action}`;

    settlement.audit_trail.push({
      action: `STATUS_CHANGED_${action.toUpperCase()}`,
      performed_by: req.user?._id || 'admin',
      performed_by_name: req.user?.name || 'Admin',
      timestamp: new Date(),
      notes: auditNote,
    });

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
    const settlements = await ProviderSettlement.find({ provider_id: provider._id }).lean();

    if (settlements.length > 0 && (!stats || (stats.todayRevenue === 0 && stats.monthRevenue === 0))) {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let todayRev = 0, todayOrds = 0;
      let monthRev = 0, monthOrds = 0;
      let totalRev = 0;

      for (const s of settlements) {
        const sDate = new Date((s as any).createdAt);
        const net = (s.gross_amount || 0) - (s.commission_amount || 0) - (s.gst_on_commission || 0) - (s.tds_amount || 0) - (s.tcs_amount || 0);
        totalRev += net;
        if (sDate >= startOfMonth) {
          monthRev += net;
          monthOrds += 1;
        }
        if (sDate >= startOfToday) {
          todayRev += net;
          todayOrds += 1;
        }
      }

      stats = {
        provider_id: provider._id,
        todayOrders: todayOrds,
        weekOrders: stats?.weekOrders || monthOrds,
        monthOrders: monthOrds,
        yearOrders: stats?.yearOrders || monthOrds,
        totalCompletedOrders: settlements.length,
        totalCancelledOrders: stats?.totalCancelledOrders || 0,
        todayRevenue: todayRev,
        monthRevenue: monthRev,
        totalRevenue: totalRev,
        acceptanceRate: stats?.acceptanceRate || 100,
        completionRate: stats?.completionRate || 100,
        lastUpdatedDate: todayStr,
      } as any;

      // Update in DB asynchronously
      const updateData = { ...stats };
      ProviderStats.findOneAndUpdate(
        { provider_id: provider._id },
        updateData,
        { upsert: true }
      ).catch(() => {});
    } else if (!stats) {
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

// @desc    Admin execution of payout release (Single Payout Trigger)
// @route   POST /api/providers/admin/settlements/:id/release-payout
// @access  Private/Admin
export const releaseSettlementPayoutAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const success = await processSingleSettlementPayout(req.params.id);
    const settlement = await ProviderSettlement.findById(req.params.id);

    // Write audit after outcome is known — notes reflect actual result, not just intent
    if (settlement) {
      settlement.audit_trail.push({
        action: 'ADMIN_FORCED_RELEASE',
        performed_by: req.user?._id || 'admin',
        performed_by_name: req.user?.name || 'Admin',
        timestamp: new Date(),
        notes: success
          ? (req.body?.reason as string) || 'Manual payout release by admin'
          : `Release attempted but blocked: ${settlement.failure_reason || settlement.status}`,
      });
      await settlement.save();
    }

    if (success || settlement?.status === 'paid' || settlement?.status === 'processing') {
      res.json({
        message: 'Payout processing initiated with RazorpayX successfully',
        settlement,
      });
    } else {
      res.status(400).json({
        message: settlement?.failure_reason || 'Payout processing failed',
        settlement,
      });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin execution of batch payouts
// @route   POST /api/providers/admin/settlements/batch-payout
// @access  Private/Admin
export const batchProcessAdminSettlements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { settlement_ids } = req.body;
    if (!Array.isArray(settlement_ids) || settlement_ids.length === 0) {
      res.status(400).json({ message: 'No settlement IDs provided for batch processing' });
      return;
    }

    const result = await batchProcessSettlements(settlement_ids);

    res.json({
      message: `Batch payout processing initiated for ${result.claimedCount} settlements`,
      batchId: result.batchId,
      totalSubmitted: result.totalSubmitted,
      claimedCount: result.claimedCount,
      skippedCount: result.skippedCount,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
