import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Booking } from '../../models/Booking';
import { sendAdminNotification, getActiveMembershipFeatures } from '../../utils/internalApi';
import mongoose from 'mongoose';

// @desc    Update booking status
// @route   PUT /api/bookings/:id
// @access  Private
export const updateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const { status } = req.body;

    if (status && status !== booking.status) {
      const validTransitions: { [key: string]: string[] } = {
        'pending': ['provider_searching', 'accepted', 'cancelled'],
        'provider_searching': ['accepted', 'cancelled'],
        'accepted': ['on_the_way', 'cancelled'],
        'on_the_way': ['arrived', 'cancelled'],
        'arrived': ['waiting_start_otp', 'cancelled'],
        'waiting_start_otp': ['in_progress', 'cancelled'],
        'in_progress': ['waiting_end_otp', 'cancelled'],
        'waiting_end_otp': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': []
      };

      const allowedNext = validTransitions[booking.status] || [];
      if (!allowedNext.includes(status)) {
        res.status(400).json({ 
          message: `Invalid status transition from '${booking.status}' to '${status}'.` 
        });
        return;
      }
    }

    booking.status = status ?? booking.status;

    const updated = await booking.save();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign provider to booking (Internal API)
// @route   PUT /api/bookings/internal/:id/assign
// @access  Public (Internal)
export const assignProviderInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Fetch to check payment status if needed, but we can do an atomic update directly
    const booking = await Booking.findOneAndUpdate(
      { 
        _id: req.params.id, 
        status: { $in: ['pending', 'provider_searching'] },
        $or: [{ provider_id: { $exists: false } }, { provider_id: null }]
      },
      {
        $set: {
          provider_id: req.body.provider_id,
          status: 'accepted',
          accepted_at: new Date()
        }
      },
      { new: true }
    );

    if (!booking) {
      // 409 Conflict if race condition lost or booking doesn't exist
      res.status(409).json({ message: 'Job already assigned or unavailable' });
      return;
    }

    // Payment Guard check (after assignment, or we could add to filter, but this is simpler)
    if (booking.payment_method !== 'cod' && booking.payment_status !== 'paid') {
      // Revert if payment failed - though dispatch shouldn't have happened.
      // ponytail: dispatch already checks this, so we just log it.
      console.warn(`[BOOKING] Assigned unpaid booking ${booking._id}`);
    }

    // Log provider assignment activity
    try {
      const BookingActivity = mongoose.model('BookingActivity');
      await BookingActivity.create({
        booking_id: booking._id,
        action: 'provider_accepted',
        actor: 'provider',
        actor_id: req.body.provider_id?.toString(),
        details: { provider_id: req.body.provider_id, status: 'accepted' }
      });
    } catch (err: any) {
      console.error('[ACTIVITY LOGGER ERROR]', err.message);
    }

    res.json(booking);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (booking.user_id.toString() !== req.user?._id.toString()) {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    const allowedStatuses = ['pending', 'accepted'];
    if (!allowedStatuses.includes(booking.status)) {
      res.status(400).json({ message: 'Cannot cancel booking in current status' });
      return;
    }

    const bookingDateTime = new Date(booking.scheduled_at);
    const diff = bookingDateTime.getTime() - Date.now();
    const oneHour = 60 * 60 * 1000;

    if (diff < oneHour) {
      // Dynamic membership rule: Free Cancellation bypasses the 1-hour window check
      const membership = await getActiveMembershipFeatures(req.user?._id as string);
      const hasFreeCancellation = membership?.role === 'user' && membership?.userConfig?.freeCancellation === true;

      if (!hasFreeCancellation) {
        res.status(400).json({ message: 'Cancellation window closed (within 1 hour of service)' });
        return;
      }
    }

    const { reason } = req.body;

    booking.status = 'cancelled';
    booking.cancelled_at = new Date();
    booking.cancelled_by = 'customer';
    booking.cancellation_reason = reason;

    await booking.save();

    // Auto-release provider if assigned
    if (booking.provider_id) {
      const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003';
      import('axios').then(axios => {
        axios.default.post(`${PROV_URL}/api/providers/internal/release`, {
          provider_id: booking.provider_id
        }, {
          headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
        }).catch(e => console.error('[BOOKING] Failed to release provider on cancel:', e.message));
      });
    }

    sendAdminNotification(
      'Booking Cancelled',
      `Booking ${booking.booking_id} was cancelled by the customer. Reason: ${reason || 'Not provided'}.`,
      'booking_alert',
      { booking_id: booking._id, reason }
    ).catch(console.error);

    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get active booking for provider (Internal API)
// @route   GET /api/bookings/internal/active-booking/:providerId
// @access  Public (Internal)
export const getActiveBookingByProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const activeBooking = await Booking.findOne({
      provider_id: new mongoose.Types.ObjectId(providerId),
      status: { $in: ['accepted', 'on_the_way', 'arrived', 'waiting_start_otp', 'in_progress', 'waiting_end_otp'] }
    }).lean();

    res.json({
      hasActiveBooking: !!activeBooking,
      booking: activeBooking
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
