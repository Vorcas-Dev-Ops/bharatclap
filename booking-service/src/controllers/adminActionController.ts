import { Request, Response, NextFunction } from 'express';
import { Booking } from '../models/Booking';
import { sendSuccess, sendError, ErrorCodes, NotFoundError, BusinessError, logger } from '@bharatclap/shared';

export const handleBookingAdminAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, providerId, reason, note, compensationAmount } = req.body;
    const adminId = (req as any).user?._id || (req as any).user?.id || 'admin';

    const booking = await Booking.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking record not found');
    }

    const previousStatus = booking.status;

    switch (action) {
      case 'MANUAL_ASSIGN':
      case 'REASSIGN_PROVIDER': {
        if (!providerId) {
          throw new BusinessError('Provider ID is required for assignment', ErrorCodes.VALIDATION_ERROR);
        }
        booking.provider_id = providerId;
        booking.status = 'assigned';
        booking.dispatch_status = 'Provider Assigned';
        booking.assigned_at = new Date();
        break;
      }

      case 'FORCE_START': {
        booking.status = 'in_progress';
        booking.started_at = new Date();
        break;
      }

      case 'FORCE_COMPLETE': {
        booking.status = 'completed';
        booking.completed_at = new Date();
        booking.payment_status = 'paid';
        booking.settlement_status = 'Created'; // Created immediately upon completion per blueprint
        break;
      }

      case 'CANCEL_WITH_WAIVER': {
        booking.status = 'cancelled';
        booking.cancelled_at = new Date();
        booking.cancellation_reason = reason || 'Cancelled by Admin with fee waiver';
        break;
      }

      case 'OVERRIDE_OTP': {
        if (booking.status === 'waiting_start_otp' || booking.status === 'arrived') {
          booking.status = 'in_progress';
          booking.started_at = new Date();
        } else if (booking.status === 'waiting_end_otp') {
          booking.status = 'completed';
          booking.completed_at = new Date();
          booking.settlement_status = 'Created';
        }
        break;
      }

      case 'ADD_INTERNAL_NOTE': {
        if (note) {
          booking.admin_notes = booking.admin_notes || [];
          booking.admin_notes.push({
            note,
            addedBy: adminId,
            createdAt: new Date()
          });
        }
        break;
      }

      default:
        throw new BusinessError(`Unsupported admin action: ${action}`, ErrorCodes.VALIDATION_ERROR);
    }

    await booking.save();

    logger.info(`Admin executed action '${action}' on booking ${booking.booking_id}`, {
      service: 'booking-service',
      action: 'ADMIN_BOOKING_ACTION',
      bookingId: booking.booking_id,
      metadata: { adminId, action, previousStatus, newStatus: booking.status, reason }
    });

    sendSuccess(res, 200, `Admin action '${action}' executed successfully`, { booking });
  } catch (err) {
    next(err);
  }
};
