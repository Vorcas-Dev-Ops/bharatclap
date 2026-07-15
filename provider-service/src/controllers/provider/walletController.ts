import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { WalletTransaction } from '../../models/WalletTransaction';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';

const getRazorpay = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/providers/wallet/recharge/create-order
// Create Razorpay recharge order & record a pending WalletTransaction
// ─────────────────────────────────────────────────────────────────────────────
export const createRechargeOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 500) {
      res.status(400).json({ message: 'Minimum recharge amount is ₹500' });
      return;
    }

    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: amount * 100, // Razorpay works in paise
      currency: 'INR',
      receipt: `recharge_${Date.now()}`
    });

    // Create a pending wallet transaction log
    const tx = await WalletTransaction.create({
      provider_id: provider._id,
      type: 'recharge',
      amount,
      balanceAfter: provider.walletBalance, // Current balance since it's pending
      referenceId: rzpOrder.id,
      description: `Razorpay wallet recharge of ₹${amount} (Pending)`,
      status: 'pending'
    });

    res.json({
      rzpOrder,
      transactionId: tx._id
    });
  } catch (error: any) {
    console.error('[WALLET] Create recharge order error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/providers/wallet/recharge/verify
// Verify payment signature, credit wallet (idempotent check)
// ─────────────────────────────────────────────────────────────────────────────
export const verifyRecharge = async (req: AuthRequest, res: Response): Promise<void> => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

  if (!amount || typeof amount !== 'number' || amount < 500) {
    res.status(400).json({ message: 'Minimum recharge amount is ₹500' });
    return;
  }

  // 1. Verify Signature
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const generatedSignature = shasum.digest('hex');

  if (generatedSignature !== razorpay_signature) {
    res.status(400).json({ message: 'Invalid payment signature' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let message = 'Recharge credited successfully';
    
    await session.withTransaction(async () => {
      // 2. Idempotency Check: Verify if this payment has already been credited
      const existingTx = await WalletTransaction.findOne({
        type: 'recharge',
        referenceId: razorpay_payment_id
      }).session(session);

      if (existingTx && existingTx.status === 'success') {
        message = 'Payment already credited';
        return;
      }

      const provider = await Provider.findOne({ user_id: req.user?._id }).session(session);
      if (!provider) {
        throw new Error('Provider profile not found');
      }

      // Optimistic Locking Check (retry is managed by Mongoose transaction retry mechanism natively)
      provider.walletBalance += amount;
      await provider.save({ session });

      // Upsert transaction status to success
      await WalletTransaction.findOneAndUpdate(
        { type: 'recharge', referenceId: razorpay_order_id },
        {
          provider_id: provider._id,
          type: 'recharge',
          amount,
          balanceAfter: provider.walletBalance,
          referenceId: razorpay_payment_id, // Save the actual payment ID as reference
          description: `Razorpay wallet recharge of ₹${amount}`,
          status: 'success'
        },
        { upsert: true, new: true, session }
      );
    });

    res.json({ success: true, message });
  } catch (error: any) {
    console.error('[WALLET] Verify payment error:', error);
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/providers/wallet/balance
// Fetch current wallet details
// ─────────────────────────────────────────────────────────────────────────────
export const getWalletBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id }).select('walletBalance reservedBalance isWalletBlocked');
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    let status: 'active' | 'low_balance' | 'blocked' = 'active';
    if (provider.isWalletBlocked || provider.walletBalance < 50) {
      status = 'blocked';
    } else if (provider.walletBalance < 200) {
      status = 'low_balance';
    }

    res.json({
      walletBalance: provider.walletBalance,
      reservedBalance: provider.reservedBalance,
      isWalletBlocked: provider.isWalletBlocked,
      status
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/providers/wallet/transactions
// Fetch transaction ledger history
// ─────────────────────────────────────────────────────────────────────────────
export const getWalletTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const transactions = await WalletTransaction.find({ provider_id: provider._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/providers/wallet/admin/wallets
// Fetch wallet statistics & overview for Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminWallets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const providers = await Provider.find({ isDeleted: false }).lean();

    let healthyCount = 0;
    let lowBalanceCount = 0;
    let blockedCount = 0;
    let inactiveCount = 0;
    let totalRevenue = 0; // Cumulative deduction lead fees today

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const detailedList = [];

    // Query deduction/recharge aggregations for statistics
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayDeductions = await WalletTransaction.aggregate([
      { $match: { type: 'deduction', status: 'success', createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    totalRevenue = todayDeductions[0]?.total || 0;

    for (const p of providers) {
      const balance = p.walletBalance || 0;
      let status: 'Active' | 'Low' | 'Blocked' = 'Active';

      if (p.isWalletBlocked || balance < 50) {
        status = 'Blocked';
        blockedCount++;
      } else if (balance < 200) {
        status = 'Low';
        lowBalanceCount++;
      } else {
        healthyCount++;
      }

      // Check last recharge date & total deductions
      const lastRechargeTx = await WalletTransaction.findOne({
        provider_id: p._id,
        type: 'recharge',
        status: 'success'
      }).sort({ createdAt: -1 });

      const totalDeductionsRes = await WalletTransaction.aggregate([
        { $match: { provider_id: p._id, type: 'deduction', status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalLeadDeductions = totalDeductionsRes[0]?.total || 0;

      // Inactive recharge check (No recharge in 30 days)
      const lastRechargeDate = lastRechargeTx?.createdAt || null;
      if (!lastRechargeDate || new Date(lastRechargeDate) < thirtyDaysAgo) {
        inactiveCount++;
      }

      detailedList.push({
        providerId: p._id,
        userId: p.user_id,
        walletBalance: balance,
        status,
        lastRechargeDate,
        totalLeadDeductions
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
