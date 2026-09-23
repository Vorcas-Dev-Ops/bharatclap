import { Request, Response } from 'express';
import { Money } from '@bharatclap/shared';
import { AuthRequest } from '../middleware/authMiddleware';
import { ProviderRepository } from '../repositories/providerRepository';
import { getDb } from '../config/db';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxx',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'xxxxxxxxxxxxxx',
});

// @desc    Get current provider's accessory orders
// @route   GET /api/accessory-orders/me
// @access  Private/Provider
export const getMyAccessoryOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await ProviderRepository.findByUserId(req.user?._id || '');
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const pool = getDb();

    const [ordersRes, countRes] = await Promise.all([
      pool.query(
        `SELECT * FROM provider.accessory_orders
         WHERE provider_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [provider.id, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM provider.accessory_orders WHERE provider_id = $1`, [provider.id])
    ]);
    
    const total = Number(countRes.rows[0]?.count) || 0;
    const orders = ordersRes.rows.map(r => ({
      _id: r.id,
      id: r.id,
      provider_id: r.provider_id,
      items: r.items,
      total_amount: Number(r.total_amount),
      grand_total: Number(r.total_amount),
      currency: r.currency,
      status: r.status,
      payment_status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json({ data: orders, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new Razorpay order for accessories
// @route   POST /api/accessory-orders/create-razorpay-order
// @access  Private/Provider
export const createAccessoryRazorpayOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await ProviderRepository.findByUserId(req.user?._id || '');
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { items, grand_total } = req.body;

    if (!items || items.length === 0) {
      res.status(400).json({ message: 'Items cannot be empty' });
      return;
    }

    const totalAmount = Number(grand_total) || 0;
    const options = {
      amount: Money.toPaise(Money.from(totalAmount)),
      currency: 'INR',
      receipt: `acc_${provider.id.slice(-12)}_${Math.floor(Date.now() / 1000)}`
    };

    const order = await razorpay.orders.create(options);
    const pool = getDb();

    // Save pending order in database
    const insertRes = await pool.query(
      `INSERT INTO provider.accessory_orders (
         provider_id, items, total_amount, currency, status
       ) VALUES ($1, $2, $3, 'INR', 'pending')
       RETURNING *`,
      [provider.id, JSON.stringify(items), totalAmount]
    );

    const dbOrder = insertRes.rows[0];

    res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      dbOrderId: dbOrder.id
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify accessory payment and mark onboarding complete
// @route   POST /api/accessory-orders/verify-payment
// @access  Private/Provider
export const verifyAccessoryPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await ProviderRepository.findByUserId(req.user?._id || '');
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET || 'xxxxxxxxxxxxxx';
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      res.status(400).json({ message: 'Payment verification failed' });
      return;
    }

    const pool = getDb();

    // Update order status
    await pool.query(
      `UPDATE provider.accessory_orders
       SET status = 'paid', updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [dbOrderId]
    );

    // Mark provider onboarding as complete
    await pool.query(
      `UPDATE provider.providers
       SET onboarding_status = 'APPROVED', updated_at = NOW()
       WHERE id = $1`,
      [provider.id]
    );

    res.json({ success: true, message: 'Payment verified and onboarding completed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all accessory orders
// @route   GET /api/accessory-orders
// @access  Private/Admin
export const getAllAccessoryOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const pool = getDb();

    const [ordersRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ao.*, p.user_id, p.kyc_status
         FROM provider.accessory_orders ao
         LEFT JOIN provider.providers p ON p.id = ao.provider_id
         ORDER BY ao.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM provider.accessory_orders`)
    ]);

    const total = Number(countRes.rows[0]?.count) || 0;
    const orders = ordersRes.rows.map(r => ({
      _id: r.id,
      id: r.id,
      provider_id: {
        _id: r.provider_id,
        user_id: r.user_id,
        kyc_status: r.kyc_status
      },
      items: r.items,
      total_amount: Number(r.total_amount),
      currency: r.currency,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json({ data: orders, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
