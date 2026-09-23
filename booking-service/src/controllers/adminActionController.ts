import { Request, Response, NextFunction } from 'express';
import { BookingRepository, mapBookingRow } from '../repositories/bookingRepository';
import { sendSuccess, ErrorCodes, NotFoundError, BusinessError, logger } from '@bharatclap/shared';
import { getDb } from '../config/db';

export const handleBookingAdminAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, providerId, reason, note } = req.body;
    const adminId = (req as any).user?._id || (req as any).user?.id || 'admin';

    const booking = await BookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking record not found');
    }

    const previousStatus = booking.status;
    const db = getDb();
    const now = new Date();

    switch (action) {
      case 'MANUAL_ASSIGN':
      case 'REASSIGN_PROVIDER': {
        if (!providerId) {
          throw new BusinessError('Provider ID is required for assignment', ErrorCodes.VALIDATION_ERROR);
        }
        await db.query(
          `UPDATE booking.bookings
           SET provider_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
               status = 'assigned',
               dispatch_status = 'Provider Assigned',
               assigned_at = $2,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $3`,
          [String(providerId), now, booking.id]
        );
        break;
      }

      case 'FORCE_START': {
        await db.query(
          `UPDATE booking.bookings
           SET status = 'in_progress',
               started_at = $1,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $2`,
          [now, booking.id]
        );
        break;
      }

      case 'FORCE_COMPLETE': {
        await db.query(
          `UPDATE booking.bookings
           SET status = 'completed',
               completed_at = $1,
               payment_status = 'paid',
               settlement_status = 'Created',
               version = version + 1,
               updated_at = NOW()
           WHERE id = $2`,
          [now, booking.id]
        );
        break;
      }

      case 'CANCEL_WITH_WAIVER': {
        await db.query(
          `UPDATE booking.bookings
           SET status = 'cancelled',
               cancelled_at = $1,
               cancelled_by = 'admin',
               cancellation_reason = $2,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $3`,
          [now, reason || 'Cancelled by Admin with fee waiver', booking.id]
        );
        break;
      }

      case 'OVERRIDE_OTP': {
        if (booking.status === 'waiting_start_otp' || booking.status === 'arrived') {
          await db.query(
            `UPDATE booking.bookings
             SET status = 'in_progress',
                 started_at = $1,
                 start_otp_verified = true,
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $2`,
            [now, booking.id]
          );
        } else if (booking.status === 'waiting_end_otp') {
          await db.query(
            `UPDATE booking.bookings
             SET status = 'completed',
                 completed_at = $1,
                 end_otp_verified = true,
                 settlement_status = 'Created',
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $2`,
            [now, booking.id]
          );
        }
        break;
      }

      case 'ADD_INTERNAL_NOTE': {
        if (note) {
          await db.query(
            `INSERT INTO booking.booking_admin_notes (booking_id, note, added_by, created_at)
             VALUES ($1, $2, $3, $4)`,
            [booking.id, note, String(adminId), now]
          );
        }
        break;
      }

      default:
        throw new BusinessError(`Unsupported admin action: ${action}`, ErrorCodes.VALIDATION_ERROR);
    }

    const updatedBooking = await BookingRepository.findById(booking.id);

    logger.info(`Admin executed action '${action}' on booking ${booking.booking_id}`, {
      service: 'booking-service',
      action: 'ADMIN_BOOKING_ACTION',
      bookingId: booking.booking_id,
      metadata: { adminId, action, previousStatus, newStatus: updatedBooking?.status, reason }
    });

    sendSuccess(res, 200, `Admin action '${action}' executed successfully`, { booking: updatedBooking });
  } catch (err) {
    next(err);
  }
};
