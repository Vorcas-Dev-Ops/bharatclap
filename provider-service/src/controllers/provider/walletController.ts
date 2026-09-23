import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { ProviderRepository } from '../../repositories/providerRepository';
import { WalletRepository } from '../../repositories/walletRepository';
import { getUsersBatch } from '../../utils/internalApi';
import { recordWalletChangeAndAudit, getWalletSummary } from '../../services/walletLedgerService';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getDb } from '../../config/db';

const getRazorpay = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });

export const createRechargeOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 500) {
      res.status(400).json({ message: 'Minimum recharge amount is ₹500' });
      return;
    }

    const provider = await ProviderRepository.findByUserId(req.user!._id);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: `recharge_${Date.now()}`
    });

    res.json({
      rzpOrder,
      orderId: rzpOrder.id
    });
  } catch (error: any) {
    console.error('[WALLET] Create recharge order error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const verifyRecharge = async (req: AuthRequest, res: Response): Promise<void> => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ message: 'Missing payment verification fields' });
    return;
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error('[WALLET] RAZORPAY_KEY_SECRET is not configured');
    res.status(500).json({ message: 'Payment verification misconfigured: secret missing' });
    return;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const submittedBuf = Buffer.from(razorpay_signature, 'utf8');

  if (expectedBuf.length !== submittedBuf.length || !crypto.timingSafeEqual(expectedBuf, submittedBuf)) {
    res.status(400).json({ message: 'Invalid payment signature' });
    return;
  }

  try {
    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
    const verifiedAmount = (rzpOrder as any).amount_paid / 100;

    if (!verifiedAmount || verifiedAmount < 500) {
      res.status(400).json({ message: `Payment amount ₹${verifiedAmount} is below minimum ₹500 or order not fully paid` });
      return;
    }

    const provider = await ProviderRepository.findByUserId(req.user!._id);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const result = await recordWalletChangeAndAudit({
      providerId: provider.id,
      amount: verifiedAmount,
      type: 'recharge',
      action: 'Recharge',
      source: 'Razorpay',
      reason: `Razorpay wallet recharge of ₹${verifiedAmount}`,
      remarks: `Payment ID: ${razorpay_payment_id}`,
      referenceId: razorpay_payment_id,
      paymentId: razorpay_payment_id,
    });

    const message = result.alreadyProcessed ? 'Payment already credited' : 'Recharge credited successfully';
    res.json({ success: true, message, balanceAfter: result.newBalance || provider.wallet_balance });
  } catch (error: any) {
    console.error('[WALLET] Verify payment error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getWalletBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await ProviderRepository.findByUserId(req.user!._id);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const isFreeAccess = provider.subscription_status === 'active' || provider.subscription_status === 'grace_period' || provider.subscription_type === 'free_trial';
    const summary = getWalletSummary(provider);

    let status: 'active' | 'low_balance' | 'blocked' = 'active';
    if (!isFreeAccess && provider.is_wallet_blocked) {
      status = 'blocked';
    } else if (!isFreeAccess && summary.availableBalance < 50) {
      status = 'blocked';
    } else if (!isFreeAccess && summary.availableBalance < 200) {
      status = 'low_balance';
    }

    res.json({ ...summary, isWalletBlocked: provider.is_wallet_blocked, isFreeAccessEnabled: isFreeAccess, isFreeAccess, status });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getWalletTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await ProviderRepository.findByUserId(req.user!._id);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const { transactions } = await WalletRepository.getTransactions(provider.id, 50, 0);
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminWallets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const providersRes = await db.query(`
      SELECT id, user_id, wallet_balance, reserved_balance, is_wallet_blocked
      FROM provider.providers
      WHERE deleted_at IS NULL
    `);

    const providers = providersRes.rows;

    let healthyCount = 0;
    let lowBalanceCount = 0;
    let blockedCount = 0;
    let inactiveCount = 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const revenueRes = await db.query(`
      SELECT COALESCE(SUM(amount), 0)::float AS total
      FROM provider.wallet_transactions
      WHERE type = 'deduction' AND status = 'success' AND created_at >= $1
    `, [todayStart]);
    const totalRevenue = revenueRes.rows[0]?.total || 0;

    const userIds = [...new Set(providers.map(p => p.user_id?.toString()).filter(Boolean))];
    const users = userIds.length ? await getUsersBatch(userIds).catch(() => []) : [];
    const userMap = new Map<string, any>();
    for (const u of users) {
      if (u && (u._id || u.id)) {
        userMap.set(String(u._id || u.id), u);
      }
    }

    const detailedList = [];
    for (const p of providers) {
      const balance = Number(p.wallet_balance) || 0;
      const reserved = Number(p.reserved_balance) || 0;
      const available = balance - reserved;
      let status: 'Active' | 'Low' | 'Blocked' = 'Active';

      if (p.is_wallet_blocked || available < 50) {
        status = 'Blocked';
        blockedCount++;
      } else if (available < 200) {
        status = 'Low';
        lowBalanceCount++;
      } else {
        healthyCount++;
      }

      const pUserIdStr = p.user_id?.toString() || '';
      const user = userMap.get(pUserIdStr);

      detailedList.push({
        providerId: p.id,
        userId: {
          _id: user?._id || user?.id || pUserIdStr,
          name: user?.name || `Provider #${String(p.id).slice(-4)}`,
          phone: user?.phone || 'N/A',
          email: user?.email || ''
        },
        walletBalance: balance,
        reservedBalance: reserved,
        availableBalance: available,
        status,
        lastRechargeDate: null,
        totalLeadDeductions: 0
      });
    }

    res.json({
      stats: {
        healthyCount,
        lowBalanceCount,
        blockedCount,
        inactiveCount,
        todayWalletRevenue: totalRevenue
      },
      wallets: detailedList
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
