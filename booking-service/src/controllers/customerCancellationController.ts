import { Request, Response, NextFunction } from 'express';
import { Booking } from '../models/Booking';
import { sendSuccess, sendError, ErrorCodes, NotFoundError, BusinessError } from '@bharatclap/shared';

export const handleCustomerCancellation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, reasonCategory } = req.body;
    const userId = (req as any).user?._id || (req as any).user?.id;

    const booking = await Booking.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking record not found');
    }

    if (String(booking.user_id) !== String(userId) && (req as any).user?.role !== 'admin') {
      throw new BusinessError('Not authorized to cancel this booking', ErrorCodes.UNAUTHORIZED);
    }

    const currentStatus = booking.status;

    // Rule 3: After Provider Arrived -> Admin Review Required
    if (['arrived', 'waiting_start_otp', 'in_progress', 'service_completed'].includes(currentStatus)) {
      booking.status = 'cancellation_requested';
      booking.cancellation_reason = reason || 'Customer requested cancellation after provider arrival';
      booking.cancel_reason_category = reasonCategory || 'other';
      await booking.save();

      sendSuccess(res, 200, 'Cancellation request submitted for Admin Operations review as provider has already arrived', {
        bookingStatus: booking.status,
        requiresAdminReview: true,
        cancellationFee: 0
      });
      return;
    }

    // Rule 1: Before Provider Accepted -> Free Cancellation
    if (['pending', 'provider_searching', 'unassigned_timeout'].includes(currentStatus)) {
      booking.status = 'cancelled';
      booking.cancelled_at = new Date();
      booking.cancelled_by = 'customer';
      booking.cancellation_fee = 0;
      booking.cancellation_reason = reason || 'Cancelled by customer before provider acceptance';
      booking.cancel_reason_category = reasonCategory || 'other';
      booking.refund_status = booking.payment_status === 'paid' ? 'initiated' : 'none';
      await booking.save();

      sendSuccess(res, 200, 'Booking cancelled freely before provider acceptance (100% refund)', {
        bookingStatus: booking.status,
        cancellationFee: 0,
        refundInitiated: booking.refund_status === 'initiated'
      });
      return;
    }

    // Rule 2: After Provider Accepted -> Cancellation Fee Applied
    if (['accepted', 'assigned', 'on_the_way'].includes(currentStatus)) {
      const cancellationFee = 50; // ₹50 standard cancellation fee
      booking.status = 'cancelled';
      booking.cancelled_at = new Date();
      booking.cancelled_by = 'customer';
      booking.cancellation_fee = cancellationFee;
      booking.cancellation_reason = reason || 'Cancelled by customer after provider acceptance';
      booking.cancel_reason_category = reasonCategory || 'other';
      booking.refund_status = booking.payment_status === 'paid' ? 'initiated' : 'none';
      await booking.save();

      sendSuccess(res, 200, `Booking cancelled after provider acceptance (₹${cancellationFee} cancellation fee applied)`, {
        bookingStatus: booking.status,
        cancellationFee,
        refundInitiated: booking.refund_status === 'initiated'
      });
      return;
    }

    throw new BusinessError(`Cannot cancel booking in current status: ${currentStatus}`, ErrorCodes.BOOKING_NOT_CANCELLABLE);
  } catch (err) {
    next(err);
  }
};
