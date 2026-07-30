import { Request, Response } from 'express';
import { Refund } from '../models/Refund';
import { Payment } from '../models/Payment';
import { sendAdminNotification, sendNotification } from '../utils/internalApi';

interface AuthRequest extends Request {
  user?: any;
}

export const getAllRefunds = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }
    
    const [refunds, total] = await Promise.all([
      Refund.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Refund.countDocuments(filter)
    ]);
      
    res.status(200).json({ success: true, data: refunds, total, page, limit });
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
      status: 'requested'
    });

    await sendAdminNotification(
      'New Refund Request',
      `A new refund request of ₹${refund.amount} has been submitted. Reason: ${reason || 'Not provided'}.`,
      'payment_alert',
      { refund_id: refund._id, booking_id: refund.booking_id }
    );

    // Trigger Refund Initiated notification
    sendNotification(
      payment.user_id.toString(),
      'Refund Initiated',
      `A refund of ₹${refund.amount} has been initiated for booking.`,
      'payment_alert',
      { refund_id: refund._id, booking_id: refund.booking_id }
    ).catch(err => console.error('[NOTIFICATION] Failed to send Refund Initiated notification:', err));

    res.status(201).json({ success: true, data: refund });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRefundStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, refund_reason, amount } = req.body;
    const refund = await Refund.findById(req.params.id);
    if (!refund) {
      res.status(404).json({ success: false, message: 'Refund request not found' });
      return;
    }

    if (!refund.original_amount) {
      refund.original_amount = refund.amount;
    }

    if (amount !== undefined) {
      refund.amount = amount;
    }

    if (status !== undefined) {
      refund.status = status;
    }

    if (refund_reason !== undefined) {
      refund.refund_reason = refund_reason;
    }

    refund.processed_by_admin = req.user?._id;
    refund.processed_at = new Date();

    await refund.save();

    if (['approved', 'completed'].includes(refund.status)) {
      const payment = await Payment.findById(refund.payment_id);
      if (payment) {
        payment.payment_status = 'refunded';
        payment.refund_metadata = {
          refund_id: refund._id.toString(),
          refund_amount: refund.amount,
          refund_reason: refund.reason || refund.refund_reason,
          refunded_at: new Date(),
        };
        payment.status_history?.push({
          status: 'refunded',
          timestamp: new Date(),
          note: `Refund of ₹${refund.amount} processed`,
        });
        await payment.save();

        if (payment.booking_id || payment.order_id) {
          try {
            const axios = (await import('axios')).default;
            const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
            await axios.post(`${BOOKING_URL}/api/bookings/internal/update-payment-status`, {
              payment_id: payment._id,
              booking_id: payment.booking_id,
              order_id: payment.order_id,
              payment_status: 'refunded',
            }, {
              headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
            });
          } catch (err: any) {
            console.error('[REFUND] Failed to sync refund status to booking service:', err.message);
          }
        }

        // Trigger Refund Completed notification
        sendNotification(
          payment.user_id.toString(),
          'Refund Completed',
          `Your refund of ₹${refund.amount} has been completed and credited back to your account.`,
          'payment_alert',
          { refund_id: refund._id, booking_id: refund.booking_id }
        ).catch(err => console.error('[NOTIFICATION] Failed to send Refund Completed notification:', err));
      }
    }

    res.status(200).json({ success: true, data: refund });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
