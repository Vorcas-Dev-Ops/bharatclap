import { Request, Response } from 'express';
import { Refund } from '../models/Refund';
import { Payment } from '../models/Payment';
import { sendAdminNotification } from '../utils/internalApi';

interface AuthRequest extends Request {
  user?: any;
}

export const getAllRefunds = async (req: Request, res: Response): Promise<void> => {
  try {
    const refunds = await Refund.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: refunds });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createRefund = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { payment_id, amount, reason } = req.body;
    
    const payment = await Payment.findById(payment_id);
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    const refund = await Refund.create({
      payment_id,
      booking_id: payment.booking_id,
      user_id: req.user?._id,
      amount: amount || payment.amount,
      reason,
      status: 'pending'
    });

    await sendAdminNotification(
      'New Refund Request',
      `A new refund request of ₹${refund.amount} has been submitted. Reason: ${reason || 'Not provided'}.`,
      'payment_alert',
      { refund_id: refund._id, booking_id: refund.booking_id }
    );

    res.status(201).json({ success: true, data: refund });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
