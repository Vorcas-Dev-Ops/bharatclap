import { Request, Response } from 'express';
import { RefundRepository } from '../repositories/refundRepository';
import { PaymentRepository } from '../repositories/paymentRepository';
import { sendAdminNotification, sendNotification } from '../utils/internalApi';

interface AuthRequest extends Request {
  user?: any;
}

export const getAllRefunds = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string;

    const { refunds, total } = await RefundRepository.findRefunds({ status, page, limit });

    res.status(200).json({ success: true, data: refunds, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createRefund = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { payment_id, amount, reason } = req.body;

    const payment = await PaymentRepository.findById(payment_id);
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    const refund = await RefundRepository.createRefund({
      bookingId: payment.booking_id,
      customerId: String(req.user?._id || payment.user_id),
      refundAmount: amount || payment.amount,
      reason,
      refundType: 'admin',
    });

    await sendAdminNotification(
      'New Refund Request',
      `A new refund request of ₹${refund.amount} has been submitted. Reason: ${reason || 'Not provided'}.`,
      'payment_alert',
      { refund_id: refund._id, booking_id: refund.booking_id }
    );

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
    const refund = await RefundRepository.findById(req.params.id);
    if (!refund) {
      res.status(404).json({ success: false, message: 'Refund request not found' });
      return;
    }

    const updated = await RefundRepository.updateRefund(req.params.id, {
      status,
      reason: refund_reason,
      refundAmount: amount,
    });

    const finalRefund = updated || refund;

    if (['approved', 'completed', 'COMPLETED'].includes(status?.toLowerCase())) {
      const payment = refund.payment_id ? await PaymentRepository.findById(refund.payment_id) : await PaymentRepository.findByBookingId(refund.booking_id);
      if (payment) {
        await PaymentRepository.updatePaymentStatus(
          payment.id,
          'Refunded',
          `Refund of ₹${finalRefund.amount} processed`
        );

        if (payment.booking_id) {
          try {
            const axios = (await import('axios')).default;
            const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
            await axios.post(`${BOOKING_URL}/api/bookings/internal/update-payment-status`, {
              payment_id: payment._id,
              booking_id: payment.booking_id,
              payment_status: 'refunded',
            }, {
              headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
            });
          } catch (err: any) {
            console.error('[REFUND] Failed to sync refund status to booking service:', err.message);
          }
        }

        sendNotification(
          payment.user_id.toString(),
          'Refund Completed',
          `Your refund of ₹${finalRefund.amount} has been completed and credited back to your account.`,
          'payment_alert',
          { refund_id: finalRefund._id, booking_id: finalRefund.booking_id }
        ).catch(err => console.error('[NOTIFICATION] Failed to send Refund Completed notification:', err));
      }
    }

    res.status(200).json({ success: true, data: finalRefund });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
