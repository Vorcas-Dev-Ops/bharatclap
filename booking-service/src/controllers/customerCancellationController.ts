import { Request, Response, NextFunction } from 'express';
import { BookingRepository } from '../repositories/bookingRepository';
import { sendSuccess, sendError, ErrorCodes, NotFoundError, BusinessError } from '@bharatclap/shared';

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

      sendSuccess(res, 200, 'Booking cancelled freely before provider acceptance (100% refund)', {
        bookingStatus: updated.status,
        cancellationFee: 0,
        refundInitiated: updated.payment_status === 'paid'
      });
      return;
    }

    // Rule 2: After Provider Accepted -> Cancellation Fee Applied
    if (['accepted', 'assigned', 'on_the_way'].includes(currentStatus)) {
      const cancellationFee = 50; // ₹50 standard cancellation fee
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

      sendSuccess(res, 200, `Booking cancelled after provider acceptance (₹${cancellationFee} cancellation fee applied)`, {
        bookingStatus: updated.status,
        cancellationFee,
        refundInitiated: updated.payment_status === 'paid'
      });
      return;
    }

    throw new BusinessError(`Cannot cancel booking in current status: ${currentStatus}`, ErrorCodes.BOOKING_NOT_CANCELLABLE);
  } catch (err) {
    next(err);
  }
};
