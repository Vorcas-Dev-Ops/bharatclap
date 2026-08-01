import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Booking } from '../../models/Booking';
import { sendAdminNotification, getActiveMembershipFeatures, updateProviderStatusInternal, cleanupBookingTrackingInternal, sendNotification, sendProviderNotification, getProvidersBatch } from '../../utils/internalApi';
import { cacheAcceptedBooking, clearBookingCache } from '../../services/bookingCacheService';
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
        'pending': ['provider_searching', 'confirmed', 'accepted', 'cancelled'],
        'provider_searching': ['confirmed', 'accepted', 'cancelled'],
        'confirmed': ['on_the_way', 'cancelled'],
        'accepted': ['on_the_way', 'confirmed', 'cancelled'],
        'on_the_way': ['reached', 'arrived', 'cancelled'],
        'arrived': ['reached', 'waiting_start_otp', 'in_progress', 'cancelled'],
        'reached': ['waiting_start_otp', 'in_progress', 'cancelled'],
        'waiting_start_otp': ['in_progress', 'cancelled'],
        'in_progress': ['waiting_end_otp', 'completed', 'cancelled'],
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

    const oldStatus = booking.status;
    booking.status = status ?? booking.status;

    const updated = await booking.save();

    // Trigger notifications for status updates
    if (status && status !== oldStatus) {
      const bUserId = updated.user_id.toString();
      const bProvId = updated.provider_id?.toString();

      const notifyProviderUser = (provId: string, title: string, msg: string, metadata?: any) => {
        getProvidersBatch([provId]).then(providers => {
          const provider = providers.length > 0 ? providers[0] : null;
          const pUser = provider?.user_id?._id?.toString() || provider?.user_id?.toString() || provId;
          sendProviderNotification(pUser, title, msg, 'booking_alert', metadata).catch(console.error);
        }).catch(() => {
          sendProviderNotification(provId, title, msg, 'booking_alert', metadata).catch(console.error);
        });
      };

      if (status === 'accepted' && bProvId) {
        sendNotification(bUserId, 'Provider Assigned', `A provider has been assigned to your booking ${updated.booking_id}.`, 'booking_alert', { booking_id: updated._id });
        notifyProviderUser(bProvId, 'Booking Confirmed', `Booking ${updated.booking_id} has been confirmed.`, { booking_id: updated._id });
      } else if (status === 'on_the_way') {
        sendNotification(bUserId, 'Provider On The Way', `Your provider is on the way for booking ${updated.booking_id}.`, 'booking_alert', { booking_id: updated._id });
        if (bProvId) notifyProviderUser(bProvId, 'Status Updated: On The Way', `Booking ${updated.booking_id} status updated to On The Way.`, { booking_id: updated._id });
      } else if (status === 'arrived') {
        sendNotification(bUserId, 'Provider Arrived', `Your provider has arrived for booking ${updated.booking_id}.`, 'booking_alert', { booking_id: updated._id });
        if (bProvId) notifyProviderUser(bProvId, 'Status Updated: Arrived', `Booking ${updated.booking_id} status updated to Arrived.`, { booking_id: updated._id });
      } else if (status === 'cancelled') {
        sendNotification(bUserId, 'Booking Cancelled', `Your booking ${updated.booking_id} has been cancelled.`, 'booking_alert', { booking_id: updated._id });
        if (bProvId) {
          notifyProviderUser(bProvId, 'Booking Cancelled', `Booking ${updated.booking_id} has been cancelled.`, { booking_id: updated._id });
        }
      }
    }

    // Trigger provider availability sync & socket tracking cleanup
    if (booking.provider_id) {
      const pId = booking.provider_id.toString();
      if (['completed', 'cancelled'].includes(updated.status)) {
        updateProviderStatusInternal(pId, false, 'available');
        cleanupBookingTrackingInternal(updated._id.toString());
      } else if (['accepted', 'in_progress', 'on_the_way'].includes(updated.status)) {
        updateProviderStatusInternal(pId, true, 'busy');
      }
    } else if (['completed', 'cancelled'].includes(updated.status)) {
      cleanupBookingTrackingInternal(updated._id.toString());
    }

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
    const targetProviderId = req.body.provider_id ? new mongoose.Types.ObjectId(req.body.provider_id) : null;

    const booking = await Booking.findOneAndUpdate(
      { 
        _id: req.params.id, 
        status: { $in: ['pending', 'provider_searching'] },
        $or: [
          { provider_id: { $exists: false } },
          { provider_id: null },
          ...(targetProviderId ? [{ provider_id: targetProviderId }] : [])
        ]
      },
      {
        $set: {
          provider_id: req.body.provider_id,
          status: 'accepted',
          accepted_at: new Date(),
          ...(req.body.estimatedDistance !== undefined && { estimatedDistance: req.body.estimatedDistance }),
          ...(req.body.estimatedTravelMinutes !== undefined && { estimatedTravelMinutes: req.body.estimatedTravelMinutes }),
          ...(req.body.estimatedArrivalTime && { estimatedArrivalTime: new Date(req.body.estimatedArrivalTime) }),
          ...(req.body.navigationUrl && { navigationUrl: req.body.navigationUrl }),
        }
      },
      { new: true }
    );

    if (!booking) {
      // 409 Conflict if race condition lost or booking doesn't exist
      res.status(409).json({ message: 'Job already assigned or unavailable' });
      return;
    }

    // Sync assigned provider status to busy
    if (req.body.provider_id) {
      updateProviderStatusInternal(req.body.provider_id.toString(), true, 'busy');
      cacheAcceptedBooking(
        String(booking._id),
        String(req.body.provider_id),
        booking.scheduled_at || new Date(),
        booking.estimatedTravelMinutes || 18
      ).catch(() => {});

      // Send provider assigned / accepted notification to user
      sendNotification(
        booking.user_id.toString(),
        'Booking Accepted by Provider',
        `Your booking ${booking.booking_id} has been accepted by the provider. They are assigned to your service.`,
        'booking_alert',
        { booking_id: booking._id, provider_id: req.body.provider_id.toString() }
      ).catch(err => console.error('[NOTIFICATION] Failed to send provider assigned notification:', err));
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

    // Trigger user and provider notifications
    const bUserId = booking.user_id.toString();
    const bProvId = booking.provider_id?.toString();

    sendNotification(
      bUserId,
      'Booking Cancelled',
      `Your booking ${booking.booking_id} has been successfully cancelled.`,
      'booking_alert',
      { booking_id: booking._id }
    ).catch(err => console.error('[NOTIFICATION] Failed to notify user on cancel:', err));

    if (bProvId) {
      sendProviderNotification(
        bProvId,
        'Booking Cancelled by Customer',
        `Booking ${booking.booking_id} has been cancelled by the customer. Reason: ${reason || 'Not provided'}.`,
        'booking_alert',
        { booking_id: booking._id, cancellation_reason: reason }
      ).catch(err => console.error('[NOTIFICATION] Failed to notify provider on cancel:', err));
    }

    // Release locked coupon (if any)
    try {
      const { CouponRedemption } = await import('../../models/CouponRedemption');
      const redemption = await CouponRedemption.findOne({ bookingId: booking._id, status: 'locked' });
      if (redemption) {
        redemption.status = 'released';
        await redemption.save();
        console.log(`[BOOKING] Locked coupon ${redemption.couponCode} released for booking ${booking._id}`);
      }
    } catch (err: any) {
      console.error('[BOOKING] Failed to release coupon lock on cancellation:', err.message);
    }

    // Auto-release provider if assigned
    if (booking.provider_id) {
      const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
      import('axios').then(axios => {
        axios.default.post(`${PROV_URL}/api/providers/internal/release`, {
          provider_id: booking.provider_id,
          booking_id: booking._id
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

// @desc    Update booking/order payment status from internal payment service / webhook
// @route   POST /api/bookings/internal/update-payment-status
// @access  Internal
export const updatePaymentStatusInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_id, order_id, payment_id, payment_status } = req.body;
    const { Order } = await import('../../models/Order');

    if (order_id) {
      await Order.findByIdAndUpdate(order_id, {
        $set: { payment_status, payment_id, payment_link_status: 'linked' }
      });
      await Booking.updateMany({ order_id }, {
        $set: { payment_status, payment_id, payment_link_status: 'linked' }
      });
    } else if (booking_id) {
      const booking = await Booking.findByIdAndUpdate(booking_id, {
        $set: { payment_status, payment_id, payment_link_status: 'linked' }
      }, { new: true });
      if (booking?.order_id) {
        await Order.findByIdAndUpdate(booking.order_id, {
          $set: { payment_status, payment_id, payment_link_status: 'linked' }
        });
      }
    }

    res.status(200).json({ success: true, message: 'Payment status updated' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reschedule booking
// @route   PUT /api/bookings/:id/reschedule
// @access  Private
export const rescheduleBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { scheduled_at, booking_time } = req.body;
    if (!scheduled_at) {
      res.status(400).json({ message: 'Scheduled date and time are required' });
      return;
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // Verify ownership or admin
    if (booking.user_id.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    const allowedStatuses = ['pending', 'provider_searching', 'accepted'];
    if (!allowedStatuses.includes(booking.status)) {
      res.status(400).json({ message: 'Cannot reschedule booking in current status' });
      return;
    }

    booking.scheduled_at = new Date(scheduled_at);
    if (booking_time) {
      booking.booking_time = booking_time;
    }

    await booking.save();

    // Trigger Notifications
    const bUserId = booking.user_id.toString();
    const bProvId = booking.provider_id?.toString();

    // User Notification
    sendNotification(
      bUserId,
      'Booking Rescheduled',
      `Your booking ${booking.booking_id} has been successfully rescheduled to ${new Date(scheduled_at).toLocaleDateString()} (${booking_time || booking.booking_time}).`,
      'booking_alert',
      { booking_id: booking._id, new_schedule: scheduled_at }
    ).catch(err => console.error('[NOTIFICATION] Failed to notify user on reschedule:', err));

    // Provider Notification
    if (bProvId) {
      sendProviderNotification(
        bProvId,
        'Booking Rescheduled',
        `Booking ${booking.booking_id} has been rescheduled to ${new Date(scheduled_at).toLocaleDateString()} (${booking_time || booking.booking_time}).`,
        'booking_alert',
        { booking_id: booking._id, new_schedule: scheduled_at }
      ).catch(err => console.error('[NOTIFICATION] Failed to notify provider on reschedule:', err));
    }

    res.json({ message: 'Booking rescheduled successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

