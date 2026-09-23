import { Response } from 'express';
import { Money } from '@bharatclap/shared';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { ProviderRepository } from '../../repositories/providerRepository';
import { recordWalletChangeAndAudit } from '../../services/walletLedgerService';
import { getUsersBatch, sendProviderNotification } from '../../utils/internalApi';
import Razorpay from 'razorpay';
import crypto from 'crypto';

export const BHARATCLAP_HUBS = [
  {
    id: 'hub_central',
    name: 'BharatClap Central Operations Hub',
    address: 'Plot 42, Sector 18, Commercial Belt, Cyber City',
    city: 'New Delhi / NCR',
    phone: '+91 98765 43210',
    openHours: '09:00 AM - 07:00 PM (Mon-Sat)',
    coordinates: [77.08, 28.49],
    navigationUrl: 'https://maps.google.com/?q=28.49,77.08',
  },
  {
    id: 'hub_south',
    name: 'BharatClap South Regional Hub',
    address: '128/A, 100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    phone: '+91 98765 43211',
    openHours: '09:00 AM - 07:00 PM (Mon-Sat)',
    coordinates: [77.64, 12.97],
    navigationUrl: 'https://maps.google.com/?q=12.97,77.64',
  },
  {
    id: 'hub_west',
    name: 'BharatClap West Zone Operations',
    address: 'Unit 4, Trade Center, BKC',
    city: 'Mumbai',
    phone: '+91 98765 43212',
    openHours: '09:00 AM - 07:00 PM (Mon-Sat)',
    coordinates: [72.86, 19.06],
    navigationUrl: 'https://maps.google.com/?q=19.06,72.86',
  },
];

// ADMIN API 1: GET /api/providers/admin/cod-summary
export const getAdminCodSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const setRes = await db.query(
      `SELECT s.*, p.user_id, p.provider_code, p.cod_due_balance, p.is_dispatch_blocked_by_cod,
              b.account_holder_name
       FROM provider.provider_settlements s
       LEFT JOIN provider.providers p ON p.id = s.provider_id
       LEFT JOIN provider.provider_bank_details b ON b.provider_id = p.id
       WHERE s.payment_type = 'cod'
       ORDER BY s.created_at DESC`
    );

    const settlements = setRes.rows;
    const userIds = Array.from(new Set(settlements.map((s: any) => String(s.user_id)).filter(Boolean)));
    const users = userIds.length ? await getUsersBatch(userIds) : [];
    const userMap = new Map<string, any>(users.map((u: any) => [String(u.id || u._id), u]));

    const providerMap = new Map<string, any>();

    for (const s of settlements) {
      const pid = String(s.provider_id);
      const u = s.user_id ? userMap.get(String(s.user_id)) : null;
      const pname = u?.name || s.account_holder_name || `Provider ${s.provider_code || pid.slice(-6)}`;
      const pcode = s.provider_code || pid.slice(-8).toUpperCase();

      const entry = providerMap.get(pid) || {
        providerId: pid,
        providerCode: pcode,
        providerName: pname,
        email: u?.email || '',
        phone: u?.phone || '',
        codJobs: 0,
        codCollected: 0,
        codDeposited: 0,
        codOutstanding: Number(s.cod_due_balance) || 0,
        commissionEarned: 0,
        isBlocked: Boolean(s.is_dispatch_blocked_by_cod),
        overdue: false,
      };

      entry.codJobs += 1;
      entry.codCollected += Number(s.gross_amount) || 0;
      entry.commissionEarned += (Number(s.commission_amount) || 0) + (Number(s.gst_on_commission) || 0);

      if (s.status === 'cod_settled') {
        entry.codDeposited += Number(s.cod_due_amount) || 0;
      }

      providerMap.set(pid, entry);
    }

    const providerList = Array.from(providerMap.values());
    res.json({
      providers: providerList,
      totalProviders: providerList.length,
      totalOutstanding: providerList.reduce((sum, p) => sum + p.codOutstanding, 0)
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN API 2: GET /api/providers/admin/cod-details/:id
export const getAdminProviderCodDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const pid = req.params.id;
    const provider = await ProviderRepository.findById(pid);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const setRes = await db.query(
      `SELECT * FROM provider.provider_settlements
       WHERE provider_id = $1 AND payment_type = 'cod'
       ORDER BY created_at DESC`,
      [provider.id]
    );

    res.json({
      provider,
      settlements: setRes.rows
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminCodDetails = getAdminProviderCodDetails;

// ADMIN API 3: POST /api/providers/admin/cod/block-toggle
export const toggleCodDispatchBlockAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { providerId, block } = req.body;
    const updRes = await db.query(
      `UPDATE provider.providers
       SET is_dispatch_blocked_by_cod = $2,
           updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1
       RETURNING *`,
      [providerId, Boolean(block)]
    );

    if (updRes.rows.length === 0) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    res.json({ success: true, isBlocked: updRes.rows[0].is_dispatch_blocked_by_cod });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN API 4: POST /api/providers/admin/cod/send-reminder
export const sendCodReminderAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { providerId, message } = req.body;
    const provider = await ProviderRepository.findById(providerId);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    if (provider.user_id) {
      await sendProviderNotification(
        provider.user_id,
        'COD Due Deposit Reminder',
        message || `Please deposit your outstanding COD due amount of ₹${provider.cod_due_balance} to avoid dispatch suspension.`,
        'system_alert',
        { provider_id: provider.id, amount: provider.cod_due_balance }
      );
    }

    res.json({ success: true, message: 'Reminder sent successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const requestCodDepositAdmin = sendCodReminderAdmin;

// ADMIN API 5: POST /api/providers/admin/cod/record-deposit
export const recordCashDepositAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { providerId, amount, receiptNumber, hubId, notes } = req.body;

    if (!providerId || !amount || amount <= 0) {
      res.status(400).json({ message: 'providerId and positive amount are required' });
      return;
    }

    const provider = await ProviderRepository.findById(providerId);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const depositAmount = Number(amount);
    const newCodDue = Math.max(0, (provider.cod_due_balance || 0) - depositAmount);

    await db.query(
      `UPDATE provider.providers
       SET cod_due_balance = $1,
           is_dispatch_blocked_by_cod = CASE WHEN $1 <= 2000 THEN FALSE ELSE is_dispatch_blocked_by_cod END,
           updated_at = NOW()
       WHERE id = $2`,
      [newCodDue, provider.id]
    );

    // Record wallet ledger transaction
    await recordWalletChangeAndAudit({
      providerId: provider.id,
      amount: depositAmount,
      type: 'credit',
      action: 'Cash Deposit at Hub',
      source: 'Admin',
      reason: `Cash deposit recorded at ${hubId || 'Hub'}. Receipt: ${receiptNumber || 'N/A'}. ${notes || ''}`,
      referenceId: `cash_dep_${receiptNumber || Date.now()}`,
      adminUser: req.user
    });

    // Mark pending COD settlements as settled
    let remaining = depositAmount;
    const pendingRes = await db.query(
      `SELECT id, cod_due_amount FROM provider.provider_settlements
       WHERE provider_id = $1 AND payment_type = 'cod' AND status = 'cod_pending'
       ORDER BY created_at ASC`,
      [provider.id]
    );

    for (const s of pendingRes.rows) {
      if (remaining <= 0) break;
      const due = Number(s.cod_due_amount);
      if (due <= remaining) {
        remaining -= due;
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
          [remaining, s.id]
        );
        remaining = 0;
      }
    }

    res.json({
      success: true,
      message: 'Cash deposit recorded successfully',
      newCodDueBalance: newCodDue
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// PROVIDER API: GET /api/providers/cod/status
export const getProviderCodStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    res.json({
      codDueBalance: provider.cod_due_balance || 0,
      isDispatchBlocked: Boolean(provider.is_dispatch_blocked_by_cod),
      threshold: 2000,
      hubs: BHARATCLAP_HUBS
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getNearestHubs = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(BHARATCLAP_HUBS);
};

export const getProviderCodHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const setRes = await db.query(
      `SELECT * FROM provider.provider_settlements
       WHERE provider_id = $1 AND payment_type = 'cod'
       ORDER BY created_at DESC`,
      [provider.id]
    );

    res.json(setRes.rows);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const initiateCodUpiRemittance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { amount } = req.body;
    const remitAmount = Number(amount) || provider.cod_due_balance || 0;

    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret12345';

    let rzpOrder;
    if (key_id.includes('dummy') || key_id.includes('mock') || process.env.NODE_ENV === 'development') {
      rzpOrder = {
        id: `order_mock_cod_${Date.now()}`,
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
          provider_id: provider.id,
          purpose: 'COD_REMITTANCE'
        }
      });
    }

    res.json({
      success: true,
      order: rzpOrder,
      key_id,
      amount: remitAmount
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const payCodOnline = initiateCodUpiRemittance;

export const verifyCodUpiRemittance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    const isMock = razorpay_order_id?.startsWith('order_mock_');
    if (!isMock && razorpay_signature) {
      const secret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret12345';
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expected !== razorpay_signature) {
        res.status(400).json({ message: 'Invalid payment signature' });
        return;
      }
    }

    const paidAmount = Number(amount) || provider.cod_due_balance || 0;
    const newCodDue = Math.max(0, (provider.cod_due_balance || 0) - paidAmount);

    await db.query(
      `UPDATE provider.providers
       SET cod_due_balance = $1,
           is_dispatch_blocked_by_cod = CASE WHEN $1 <= 2000 THEN FALSE ELSE is_dispatch_blocked_by_cod END,
           updated_at = NOW()
       WHERE id = $2`,
      [newCodDue, provider.id]
    );

    // Update settlements
    let remaining = paidAmount;
    const pendingRes = await db.query(
      `SELECT id, cod_due_amount FROM provider.provider_settlements
       WHERE provider_id = $1 AND payment_type = 'cod' AND status = 'cod_pending'
       ORDER BY created_at ASC`,
      [provider.id]
    );

    for (const s of pendingRes.rows) {
      if (remaining <= 0) break;
      const due = Number(s.cod_due_amount);
      if (due <= remaining) {
        remaining -= due;
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
          [remaining, s.id]
        );
        remaining = 0;
      }
    }

    res.json({
      success: true,
      message: 'COD dues remitted successfully online!',
      newCodDueBalance: newCodDue
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
