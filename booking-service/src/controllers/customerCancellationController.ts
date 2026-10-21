import { Request, Response, NextFunction } from 'express';
import { BookingRepository } from '../repositories/bookingRepository';
import { sendSuccess, sendError, ErrorCodes, NotFoundError, BusinessError, getInternalServiceKey } from '@bharatclap/shared';
import { getDb } from '../config/db';
import { triggerRefundEvaluationInternal, sendNotification, sendProviderNotification } from '../utils/internalApi';
import axios from 'axios';

const CANCELLATION_FEE = 50; // ₹50 standard cancellation fee after provider acceptance

export const handleCustomerCancellation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, reasonCategory } = req.body;
    const userId = (req as any).user?._id || (req as any).user?.id;

    const booking = await BookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking record not found');
    }

    if (String(booking.user_id) !== String(userId) && (req as any).user?.role !== 'admin') {
      throw new BusinessError('Not authorized to cancel this booking', ErrorCodes.UNAUTHORIZED);
    }

    const currentStatus = booking.status;
    const isPaid = booking.payment_status === 'paid' || booking.payment_status === 'completed';

    // Rule 3: After Provider Arrived -> Admin Review Required
    if (['arrived', 'waiting_start_otp', 'in_progress', 'service_completed'].includes(currentStatus)) {
      const updated = await BookingRepository.update(booking.id, {
        status: 'cancellation_requested',
        cancel_reason: reason || 'Customer requested cancellation after provider arrival',
        cancel_reason_category: reasonCategory || 'other',
      });

      sendSuccess(res, 200, 'Cancellation request submitted for Admin Operations review as provider has already arrived', {
        bookingStatus: updated?.status || 'cancellation_requested',
        requiresAdminReview: true,
        cancellationFee: 0
      });
      return;
    }

    // Rule 1: Before Provider Accepted -> Free Cancellation
    if (['pending', 'provider_searching', 'unassigned_timeout'].includes(currentStatus)) {
      const updated = await BookingRepository.atomicCancel(
        booking.id,
        booking.version,
        'customer',
        reason || 'Cancelled by customer before provider acceptance',
        reasonCategory || 'other'
      );

      if (!updated) {
        throw new BusinessError('Booking was modified concurrently, please refresh and retry', ErrorCodes.VERSION_CONFLICT);
      }

      // Trigger full refund for paid bookings
      if (isPaid) {
        triggerRefundEvaluationInternal(String(booking.id), 'CUSTOMER_CANCELLATION')
          .catch(err => console.error('[CANCELLATION] Refund evaluation failed:', err?.message));
      }

      sendNotification(
        String(booking.user_id), 'Booking Cancelled',
        `Your booking ${booking.booking_id} has been cancelled.`, 'booking_alert',
        { booking_id: booking.id }
      ).catch(() => {});

      sendSuccess(res, 200, 'Booking cancelled freely before provider acceptance (100% refund)', {
        bookingStatus: updated.status,
        cancellationFee: 0,
        refundInitiated: isPaid
      });
      return;
    }

    // Rule 2: After Provider Accepted -> Cancellation Fee Applied
    if (['accepted', 'assigned', 'on_the_way'].includes(currentStatus)) {
      const updated = await BookingRepository.atomicCancel(
        booking.id,
        booking.version,
        'customer',
        reason || 'Cancelled by customer after provider acceptance',
        reasonCategory || 'other'
      );

      if (!updated) {
        throw new BusinessError('Booking was modified concurrently, please refresh and retry', ErrorCodes.VERSION_CONFLICT);
      }

      // Persist cancellation fee on booking
      const db = getDb();
      await db.query(
        `UPDATE booking.bookings SET cancellation_fee = $1, updated_at = NOW() WHERE id = $2`,
        [CANCELLATION_FEE, booking.id]
      ).catch(() => {});

      // Trigger partial refund (amount minus fee) for paid bookings
      if (isPaid) {
        // ponytail: send directly to refund-service with cancellation_fee
        // triggerRefundEvaluationInternal doesn't support the fee param
        const REFUND_URL = process.env.REFUND_SERVICE_URL || 'http://127.0.0.1:5007';
        axios.post(`${REFUND_URL}/api/refunds/internal/evaluate`, {
          booking_id: String(booking.id),
          reason: 'CUSTOMER_CANCELLATION',
          cancellation_fee: CANCELLATION_FEE,
        }, {
          headers: {
            'x-internal-service-key': getInternalServiceKey(),
            'x-idempotency-key': `${booking.id}:CUSTOMER_CANCELLATION:${CANCELLATION_FEE}`
          }
        }).catch(err => console.error('[CANCELLATION] Direct refund evaluation failed:', err?.message));
      }

      // Release provider
      if (booking.provider_id) {
        const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
        axios.post(`${PROV_URL}/api/providers/internal/release`, {
          provider_id: booking.provider_id,
          booking_id: booking.id
        }, {
          headers: { 'x-internal-service-key': getInternalServiceKey() }
        }).catch(e => console.error('[CANCELLATION] Failed to release provider:', e.message));

        // Lead refund outbox
        await db.query(
          `INSERT INTO booking.lead_refund_outbox (event_id, booking_id, provider_id, amount, reason, status)
           VALUES ($1, $2, $3::uuid, $4, $5, 'PENDING')
           ON CONFLICT (event_id) DO NOTHING`,
          [
            `refund_${booking.id}`,
            booking.id,
            booking.provider_id,
            booking.payable_amount || 0,
            reason || 'Customer cancelled after acceptance'
          ]
        ).catch(err => console.error('[CANCELLATION] Lead refund outbox error:', err.message));

        sendProviderNotification(
          String(booking.provider_id),
          'Booking Cancelled by Customer',
          `Booking ${booking.booking_id} has been cancelled. Reason: ${reason || 'Not provided'}.`,
          'booking_alert',
          { booking_id: booking.id, cancellation_reason: reason }
        ).catch(() => {});
      }

      sendNotification(
        String(booking.user_id), 'Booking Cancelled',
        `Your booking ${booking.booking_id} has been cancelled. A cancellation fee of ₹${CANCELLATION_FEE} applies.`,
        'booking_alert', { booking_id: booking.id }
      ).catch(() => {});

      sendSuccess(res, 200, `Booking cancelled after provider acceptance (₹${CANCELLATION_FEE} cancellation fee applied)`, {
        bookingStatus: updated.status,
        cancellationFee: CANCELLATION_FEE,
        refundInitiated: isPaid
      });
      return;
    }

    throw new BusinessError(`Cannot cancel booking in current status: ${currentStatus}`, ErrorCodes.BOOKING_NOT_CANCELLABLE);
  } catch (err) {
    next(err);
  }
};
