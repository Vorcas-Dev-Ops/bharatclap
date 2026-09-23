import { Request, Response } from 'express';
import { Money } from '@bharatclap/shared';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { ProviderRepository } from '../../repositories/providerRepository';
import { SettlementRepository } from '../../repositories/settlementRepository';
import { recordWalletChangeAndAudit } from '../../services/walletLedgerService';
import { getUsersBatch } from '../../utils/internalApi';
import { razorpayXService } from '../../services/razorpayXService';
import { batchProcessSettlements, processSingleSettlementPayout } from '../../services/batchSettlementProcessor';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// @desc    Internal API to create provider settlement upon job completion
// @route   POST /api/providers/internal/settlements/create
// @access  Internal
export const createInternalSettlement = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { provider_id, booking_id, booking_display_id, payment_type, payable_amount, commission_percentage, service_name, variant_name } = req.body;

    // 1. Check if duplicate settlement exists
    const duplicateRes = await db.query(
      `SELECT id FROM provider.provider_settlements WHERE booking_id::text = $1 LIMIT 1`,
      [String(booking_id)]
    );
    if (duplicateRes.rows.length > 0) {
      res.status(409).json({ message: 'Settlement already exists for this booking' });
      return;
    }

    // 2. Multi-stage provider lookup: matches id, user_id, or provider_code
    const providerIdStr = String(provider_id || '').trim();
    let provider = await ProviderRepository.findById(providerIdStr);
    if (!provider) {
      provider = await ProviderRepository.findByUserId(providerIdStr);
    }
    if (!provider) {
      provider = await ProviderRepository.findByProviderCode(providerIdStr);
    }

    if (!provider) {
      res.status(404).json({ message: `Provider not found for ID/Code: ${provider_id}` });
      return;
    }

    // Load configurable finance rates
    let cfg: any = {};
    try {
      const cfgRes = await db.query('SELECT settings FROM provider.dispatch_settings LIMIT 1');
      cfg = cfgRes.rows[0]?.settings || {};
    } catch (_) {}

    const gstPct = cfg.gstRateOnCommission ?? 18;
    const tdsPct = cfg.tdsRateOnGross ?? 1;
    const tcsPct = cfg.tcsRateOnGross ?? 1;
    const holdDays = cfg.settlementHoldDays ?? 3;
    const defaultCommPct = cfg.defaultCommissionPercentage ?? 20;

    // Calculations — exact decimal arithmetic via Money utility
    const gross = Money.from(payable_amount);
    const comm_pct = Number(commission_percentage || defaultCommPct);
    const commission = Money.percentage(gross, comm_pct);
    const gst = Money.percentage(commission, gstPct);
    const tds = Money.percentage(gross, tdsPct);
    const tcs = Money.percentage(gross, tcsPct);

    const gross_amount = gross.toNumber();
    const commission_amount = commission.toNumber();
    const gst_on_commission = gst.toNumber();
    const tds_amount = tds.toNumber();
    const tcs_amount = tcs.toNumber();

    let net_payable_amount = 0;
    let cod_due_amount = 0;
    let status: 'pending_hold' | 'cod_pending';
    let hold_ends_at: Date | undefined;

    if (payment_type === 'online') {
      const net = gross.sub(commission).sub(gst).sub(tds).sub(tcs);
      net_payable_amount = net.toNumber();
      status = 'pending_hold';
      hold_ends_at = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000);
    } else {
      // COD
      const due = commission.add(gst).add(tds).add(tcs);
      cod_due_amount = due.toNumber();
      status = 'cod_pending';
    }

    // Insert into provider.provider_settlements
    const settlementRes = await db.query(
      `INSERT INTO provider.provider_settlements (
         provider_id, booking_id, booking_display_id, service_name, variant_name,
         payment_type, gross_amount, commission_percentage, commission_amount,
         gst_on_commission, tds_amount, tcs_amount, net_payable_amount, cod_due_amount,
         status, audit_trail
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12, $13, $14,
         $15, $16::jsonb
       ) RETURNING *`,
      [
        provider.id,
        booking_id,
        booking_display_id || String(booking_id),
        service_name || '',
        variant_name || '',
        payment_type,
        gross_amount,
        comm_pct,
        commission_amount,
        gst_on_commission,
        tds_amount,
        tcs_amount,
        net_payable_amount,
        cod_due_amount,
        status,
        JSON.stringify([{
          action: 'SETTLEMENT_CREATED',
          performed_by: 'system',
          timestamp: new Date().toISOString(),
          notes: `Settlement initialized for ${payment_type} payment`
        }])
      ]
    );

    const settlement = settlementRes.rows[0];

    // If COD, update provider COD due balance
    if (payment_type === 'cod' && cod_due_amount > 0) {
      await db.query(
        `UPDATE provider.providers
         SET cod_due_balance = cod_due_balance + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [cod_due_amount, provider.id]
      );
    }

    res.json({ message: 'Settlement created successfully', settlement });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update provider bank account details
// @route   POST /api/providers/bank-details
// @access  Private/Provider
export const updateBankDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
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

    const provider = await ProviderRepository.findByUserId(String(req.user?.id || req.user?._id));
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const bankObj = {
      accountHolderName: cleanHolder,
      accountNumber: cleanAccount,
      ifscCode: cleanIfsc,
      bankName: cleanBank,
      status: 'pending' as const,
    };

    // RazorpayX Onboarding Integration
    let contactId = provider.razorpay_contact_id;
    if (!contactId) {
      const contactRes = await razorpayXService.createContact({ ...provider, bankDetails: bankObj });
      contactId = contactRes.id;
    }

    const fundAccountRes = await razorpayXService.createFundAccount(contactId, bankObj);
    const validationRes = await razorpayXService.validateFundAccount(fundAccountRes.id);

    // Upsert into provider.provider_bank_details
    await db.query(
      `INSERT INTO provider.provider_bank_details (
         provider_id, account_holder_name, account_number_last4, ifsc_code, bank_name, status
       ) VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (provider_id) DO UPDATE SET
         account_holder_name = EXCLUDED.account_holder_name,
         account_number_last4 = EXCLUDED.account_number_last4,
         ifsc_code = EXCLUDED.ifsc_code,
         bank_name = EXCLUDED.bank_name,
         status = 'pending',
         updated_at = NOW()`,
      [provider.id, cleanHolder, cleanAccount.slice(-4), cleanIfsc, cleanBank]
    );

    await db.query(
      `UPDATE provider.providers
       SET razorpay_contact_id = $1,
           razorpay_fund_account_id = $2,
           razorpay_account_status = 'UNDER_REVIEW',
           updated_at = NOW()
       WHERE id = $3`,
      [contactId, fundAccountRes.id, provider.id]
    );

    res.json({
      message: 'Bank details submitted, verification pending',
      status: 'pending',
      razorpay_contact_id: contactId,
      razorpay_fund_account_id: fundAccountRes.id,
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
    const db = getDb();
    const provider = await ProviderRepository.findByUserId(String(req.user?.id || req.user?._id));
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const setRes = await db.query(
      `SELECT * FROM provider.provider_settlements
       WHERE provider_id = $1
       ORDER BY created_at DESC`,
      [provider.id]
    );
    const settlements = setRes.rows.map(s => ({
      ...s,
      gross_amount: Number(s.gross_amount),
      commission_amount: Number(s.commission_amount),
      net_payable_amount: Number(s.net_payable_amount),
      cod_due_amount: Number(s.cod_due_amount),
      createdAt: s.created_at,
      updatedAt: s.updated_at
    }));

    const availableEarnings = settlements
      .filter(s => s.status === 'ready_for_payout' && s.payment_type === 'online')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    const pendingSettlement = settlements
      .filter(s => s.status === 'pending_hold' && s.payment_type === 'online')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    const totalPaid = settlements
      .filter(s => s.status === 'paid' && s.payment_type === 'online')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    res.json({
      availableEarnings,
      pendingSettlement,
      totalPaid,
      codDues: provider.cod_due_balance || 0,
      bankStatus: provider.bank_details?.status || 'not_configured',
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
    const db = getDb();
    const { amount, paymentMethod } = req.body;
    
    if (!amount || amount <= 0) {
      res.status(400).json({ message: 'Invalid payment amount' });
      return;
    }

    const provider = await ProviderRepository.findByUserId(String(req.user?.id || req.user?._id));
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const remitAmount = Math.min(amount, provider.cod_due_balance || amount);
    const availableCredit = (provider.wallet_balance - provider.reserved_balance) + provider.credit_limit;

    if ((paymentMethod === 'wallet' || !paymentMethod) && availableCredit >= remitAmount) {
      await recordWalletChangeAndAudit({
        providerId: provider.id,
        amount: remitAmount,
        type: 'deduction',
        action: 'COD Remittance',
        source: 'System',
        reason: 'COD due remittance payout to platform',
        referenceId: `cod_remit_${provider.id}_${Date.now()}`,
      });

      const newCodDue = Math.max(0, (provider.cod_due_balance || 0) - remitAmount);
      await db.query(
        `UPDATE provider.providers
         SET cod_due_balance = $1,
             is_dispatch_blocked_by_cod = CASE WHEN $1 <= 2000 THEN FALSE ELSE is_dispatch_blocked_by_cod END,
             updated_at = NOW()
         WHERE id = $2`,
        [newCodDue, provider.id]
      );

      // Settle COD settlements in order
      let remainingToDeduct = remitAmount;
      const codSetRes = await db.query(
        `SELECT id, cod_due_amount FROM provider.provider_settlements
         WHERE provider_id = $1 AND payment_type = 'cod' AND status = 'cod_pending'
         ORDER BY created_at ASC`,
        [provider.id]
      );

      for (const s of codSetRes.rows) {
        if (remainingToDeduct <= 0) break;
        const due = Number(s.cod_due_amount);
        if (due <= remainingToDeduct) {
          remainingToDeduct -= due;
          await db.query(
            `UPDATE provider.provider_settlements
             SET status = 'cod_settled',
                 cod_due_amount = 0,
                 updated_at = NOW()
             WHERE id = $1`,
            [s.id]
          );
        } else {
          await db.query(
            `UPDATE provider.provider_settlements
             SET cod_due_amount = cod_due_amount - $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [remainingToDeduct, s.id]
          );
          remainingToDeduct = 0;
        }
      }

      res.json({
        success: true,
        method: 'wallet',
        message: 'COD dues remitted successfully using wallet credit',
        walletBalance: provider.wallet_balance - remitAmount,
        codDueBalance: newCodDue
      });
      return;
    }

    // Online Payment via Razorpay
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret12345';

    let rzpOrder;
    if (key_id.includes('dummy') || key_id.includes('mock') || process.env.NODE_ENV === 'development') {
      rzpOrder = {
        id: `order_mock_cod_remit_${Date.now()}`,
        amount: Money.toPaise(Money.from(remitAmount)),
        currency: 'INR',
        receipt: `cod_remit_${Date.now()}`
      };
    } else {
      const razorpay = new Razorpay({ key_id, key_secret });
      rzpOrder = await razorpay.orders.create({
        amount: Money.toPaise(Money.from(remitAmount)),
        currency: 'INR',
        receipt: `cod_remit_${Date.now()}`,
        notes: {
          provider_id: String(provider.id),
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
      codDueBalance: provider.cod_due_balance
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
    const db = getDb();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    const provider = await ProviderRepository.findByUserId(String(req.user?.id || req.user?._id));
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

    const payMoney = Money.from(amount || provider.cod_due_balance || 0);
    const payAmount = payMoney.toNumber();

    const newBalance = Math.max(0, (provider.cod_due_balance || 0) - payAmount);
    await db.query(
      `UPDATE provider.providers
       SET cod_due_balance = $1,
           is_dispatch_blocked_by_cod = CASE WHEN $1 <= 2000 THEN FALSE ELSE is_dispatch_blocked_by_cod END,
           updated_at = NOW()
       WHERE id = $2`,
      [newBalance, provider.id]
    );

    let remainingToDeduct = payAmount;
    const codSetRes = await db.query(
      `SELECT id, cod_due_amount FROM provider.provider_settlements
       WHERE provider_id = $1 AND payment_type = 'cod' AND status = 'cod_pending'
       ORDER BY created_at ASC`,
      [provider.id]
    );

    for (const s of codSetRes.rows) {
      if (remainingToDeduct <= 0) break;
      const due = Number(s.cod_due_amount);
      if (due <= remainingToDeduct) {
        remainingToDeduct -= due;
        await db.query(
          `UPDATE provider.provider_settlements
           SET status = 'cod_settled',
               cod_due_amount = 0,
               updated_at = NOW()
           WHERE id = $1`,
          [s.id]
        );
      } else {
        await db.query(
          `UPDATE provider.provider_settlements
           SET cod_due_amount = cod_due_amount - $1,
               updated_at = NOW()
           WHERE id = $2`,
          [remainingToDeduct, s.id]
        );
        remainingToDeduct = 0;
      }
    }

    res.json({
      success: true,
      message: 'COD dues remitted successfully via online payment!',
      codDueBalance: newBalance
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
    const db = getDb();
    const setRes = await db.query(
      `SELECT s.*, p.user_id, p.provider_code, p.wallet_balance, p.reserved_balance, p.credit_limit,
              b.account_holder_name, b.account_number_last4, b.ifsc_code, b.bank_name
       FROM provider.provider_settlements s
       LEFT JOIN provider.providers p ON p.id = s.provider_id
       LEFT JOIN provider.provider_bank_details b ON b.provider_id = p.id
       ORDER BY s.created_at DESC`
    );

    const settlements = setRes.rows.map(r => ({
      ...r,
      gross_amount: Number(r.gross_amount),
      commission_amount: Number(r.commission_amount),
      gst_on_commission: Number(r.gst_on_commission),
      tds_amount: Number(r.tds_amount),
      tcs_amount: Number(r.tcs_amount),
      net_payable_amount: Number(r.net_payable_amount),
      cod_due_amount: Number(r.cod_due_amount),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      provider_id: {
        _id: r.provider_id,
        user_id: r.user_id,
        provider_code: r.provider_code,
        walletBalance: Number(r.wallet_balance) || 0,
        bankDetails: r.account_holder_name ? {
          accountHolderName: r.account_holder_name,
          accountNumberLast4: r.account_number_last4,
          ifscCode: r.ifsc_code,
          bankName: r.bank_name
        } : null
      }
    }));

    // Fetch user details in batch from auth-service
    const userIds = Array.from(new Set(settlements.map(s => s.provider_id?.user_id).filter(Boolean)));
    const users = userIds.length ? await getUsersBatch(userIds) : [];
    const userMap = new Map<string, any>();
    for (const u of users) {
      if (u && (u.id || u._id)) userMap.set(String(u.id || u._id), u);
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

    const failedPayouts = settlements
      .filter(s => s.status === 'failed')
      .reduce((sum, s) => sum + s.net_payable_amount, 0);

    const todaySettlements = settlements.filter(s => new Date(s.createdAt) >= todayStart);
    const todayRevenue = todaySettlements.reduce((sum, s) => sum + (s.commission_amount || 0) + (s.gst_on_commission || 0), 0);
    const todayOnlineRevenue = todaySettlements.filter(s => s.payment_type === 'online').reduce((sum, s) => sum + (s.commission_amount || 0) + (s.gst_on_commission || 0), 0);
    const todayCodRevenue = todaySettlements.filter(s => s.payment_type === 'cod').reduce((sum, s) => sum + (s.commission_amount || 0) + (s.gst_on_commission || 0), 0);

    res.json({
      stats: {
        totalPendingHold,
        totalReadyForPayout,
        totalPaid,
        totalCodOutstanding,
        failedPayouts,
        todayRevenue,
        todayOnlineRevenue,
        todayCodRevenue,
        todayJobs: todaySettlements.length
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
    const db = getDb();
    const { action } = req.body;
    const settlementId = req.params.id;

    let targetStatus = 'ready_for_payout';
    if (action === 'hold') targetStatus = 'held_by_admin';
    else if (action === 'retry' || action === 'approve') targetStatus = 'ready_for_payout';
    else {
      res.status(400).json({ message: 'Invalid settlement action' });
      return;
    }

    const auditEntry = {
      action: `STATUS_CHANGED_${action.toUpperCase()}`,
      performed_by: req.user?.id || req.user?._id || 'admin',
      timestamp: new Date().toISOString(),
      notes: `Admin action: ${action}`
    };

    const updateRes = await db.query(
      `UPDATE provider.provider_settlements
       SET status = $2,
           audit_trail = COALESCE(audit_trail, '[]'::jsonb) || $3::jsonb,
           updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1
       RETURNING *`,
      [settlementId, targetStatus, JSON.stringify([auditEntry])]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ message: 'Settlement record not found' });
      return;
    }

    res.json({ message: `Settlement action '${action}' applied successfully`, settlement: updateRes.rows[0] });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get precomputed provider performance analytics
// @route   GET /api/providers/dashboard-analytics
// @access  Private/Provider
export const getProviderDashboardAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const provider = await ProviderRepository.findByUserId(String(req.user?.id || req.user?._id));
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const aggRes = await db.query(
      `SELECT 
         COUNT(*)::int AS total_completed,
         COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN 1 ELSE 0 END), 0)::int AS today_orders,
         COALESCE(SUM(CASE WHEN created_at >= date_trunc('week', CURRENT_DATE) THEN 1 ELSE 0 END), 0)::int AS week_orders,
         COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) THEN 1 ELSE 0 END), 0)::int AS month_orders,
         COALESCE(SUM(gross_amount - commission_amount - gst_on_commission - tds_amount - tcs_amount), 0)::numeric(12,2) AS total_revenue,
         COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN gross_amount - commission_amount - gst_on_commission - tds_amount - tcs_amount ELSE 0 END), 0)::numeric(12,2) AS today_revenue,
         COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) THEN gross_amount - commission_amount - gst_on_commission - tds_amount - tcs_amount ELSE 0 END), 0)::numeric(12,2) AS month_revenue
       FROM provider.provider_settlements
       WHERE provider_id = $1`,
      [provider.id]
    );

    const agg = aggRes.rows[0] || {};
    res.json({
      provider_id: provider.id,
      todayOrders: Number(agg.today_orders) || 0,
      weekOrders: Number(agg.week_orders) || 0,
      monthOrders: Number(agg.month_orders) || 0,
      totalCompletedOrders: Number(agg.total_completed) || 0,
      todayRevenue: Number(agg.today_revenue) || 0,
      monthRevenue: Number(agg.month_revenue) || 0,
      totalRevenue: Number(agg.total_revenue) || 0,
      acceptanceRate: 100,
      completionRate: 100,
      averageRating: provider.average_rating || 4.5
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin creation of manual ledger adjustments (Bonus, Penalty, Fuel, Festival)
// @route   POST /api/providers/admin/adjustments
// @access  Private/Admin
export const createManualAdjustmentAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { provider_id, type, amount, reason } = req.body;

    if (!provider_id || !amount || amount <= 0 || !reason) {
      res.status(400).json({ message: 'Provider ID, positive amount, and reason are required' });
      return;
    }

    const provider = await ProviderRepository.findById(String(provider_id));
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const isCredit = ['bonus', 'fuel_allowance', 'compensation'].includes(type);
    const adjustmentAmount = Money.from(amount).toNumber();
    const adjRef = `ADJ_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await recordWalletChangeAndAudit({
      providerId: provider.id,
      amount: adjustmentAmount,
      type: isCredit ? 'credit' : 'debit',
      action: `Admin Manual Adjustment (${type.toUpperCase()})`,
      source: 'Admin',
      reason,
      remarks: `Type: ${type}`,
      adminUser: (req as AuthRequest).user,
      referenceId: adjRef,
    });

    const updatedProvider = await ProviderRepository.findById(provider.id);
    res.status(201).json({
      message: `Manual adjustment '${type}' of ₹${adjustmentAmount} recorded successfully`,
      walletBalance: updatedProvider?.wallet_balance,
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
    const success = await processSingleSettlementPayout(req.params.id, { skipCapCheck: true });
    const settlement = await SettlementRepository.findById(req.params.id);

    if (success || settlement?.status === 'paid' || settlement?.status === 'processing') {
      res.json({
        message: 'Payout processing initiated with RazorpayX successfully',
        settlement,
      });
    } else {
      res.status(400).json({
        message: 'Payout processing failed',
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
