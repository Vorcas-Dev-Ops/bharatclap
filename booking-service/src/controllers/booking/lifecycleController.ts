import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Booking } from '../../models/Booking';
import { sendAdminNotification, getActiveMembershipFeatures } from '../../utils/internalApi';

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
        'pending': ['accepted', 'cancelled'],
        'accepted': ['on_the_way', 'cancelled'],
        'on_the_way': ['arrived'],
        'arrived': ['waiting_start_otp'],
        'waiting_start_otp': ['in_progress'],
        'in_progress': ['waiting_end_otp'],
        'waiting_end_otp': ['completed'],
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
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (booking.status !== 'pending') {
      res.status(400).json({ message: 'Booking is already assigned or unavailable' });
      return;
    }

    booking.provider_id = req.body.provider_id;
    booking.status = 'accepted';
    await booking.save();

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
