import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { AccessoryOrder } from '../models/AccessoryOrder';
import { Provider } from '../models/Provider';
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
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const [orders, total] = await Promise.all([
      AccessoryOrder.find({ provider_id: provider._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AccessoryOrder.countDocuments({ provider_id: provider._id })
    ]);
    
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
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { items, subtotal, gst_amount, delivery_charge, grand_total } = req.body;

    if (!items || items.length === 0) {
      res.status(400).json({ message: 'Items cannot be empty' });
      return;
    }

    const options = {
      amount: Math.round(grand_total * 100), // amount in the smallest currency unit
      currency: 'INR',
      receipt: `acc_${provider._id.toString().slice(-12)}_${Math.floor(Date.now() / 1000)}`
    };

    const order = await razorpay.orders.create(options);

    // Save pending order in database
    const accessoryOrder = await AccessoryOrder.create({
      provider_id: provider._id,
      items,
      subtotal,
      gst_amount,
      delivery_charge,
      grand_total,
      payment_status: 'pending',
      razorpay_order_id: order.id,
      order_status: 'pending'
    });

    res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      dbOrderId: accessoryOrder._id
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
    const provider = await Provider.findOne({ user_id: req.user?._id });
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

    // Update order status
    await AccessoryOrder.findByIdAndUpdate(dbOrderId, {
      payment_status: 'paid',
      payment_id: razorpay_payment_id
    });

    // Mark provider onboarding as complete
    provider.providerKitCompleted = true;
    provider.accessoriesPurchased = true;
    provider.onboardingCompleted = true;
    await provider.save();

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

    const [orders, total] = await Promise.all([
      AccessoryOrder.find()
        .populate('provider_id', 'user_id kyc_status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AccessoryOrder.countDocuments()
    ]);

    res.json({ data: orders, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
