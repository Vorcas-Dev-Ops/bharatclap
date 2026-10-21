import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { BookingRepository, mapBookingRow } from '../../repositories/bookingRepository';
import {
  sendAdminNotification,
  getActiveMembershipFeatures,
  updateProviderStatusInternal,
  sendNotification,
  sendProviderNotification,
  getProviderByUserId
} from '../../utils/internalApi';
import { cacheAcceptedBooking, clearBookingCache } from '../../services/bookingCacheService';
import { withTransaction } from '@bharatclap/shared';
import { logBookingActivity } from '../../utils/activityLogger';
import { CouponRedemptionRepository } from '../../repositories/couponRedemptionRepository';
import axios from 'axios';

// @desc    Update booking status
// @route   PUT /api/bookings/:id
// @access  Private
export const updateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const { status } = req.body;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    if (status && status !== booking.status) {
      const validTransitions: { [key: string]: string[] } = {
        'pending': ['provider_searching', 'confirmed', 'accepted', 'cancelled', 'rejected', 'expired'],
        'provider_searching': ['confirmed', 'accepted', 'cancelled', 'rejected', 'unassigned_timeout', 'expired'],
        'confirmed': ['on_the_way', 'delayed', 'cancelled', 'rejected'],
        'accepted': ['on_the_way', 'confirmed', 'delayed', 'cancelled', 'rejected'],
        'on_the_way': ['reached', 'arrived', 'delayed', 'cancelled', 'rejected'],
        'arrived': ['reached', 'waiting_start_otp', 'in_progress', 'cancelled', 'rejected'],
        'reached': ['waiting_start_otp', 'in_progress', 'cancelled', 'rejected'],
        'waiting_start_otp': ['in_progress', 'cancelled', 'rejected'],
        'in_progress': ['waiting_end_otp', 'completed', 'cancelled', 'rejected'],
        'waiting_end_otp': ['service_completed', 'completed', 'cancelled', 'rejected'],
        'service_completed': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': [],
        'rejected': [],
        'expired': [],
        'delayed': ['on_the_way', 'reached', 'arrived', 'cancelled'],
        'unassigned_timeout': ['provider_searching', 'cancelled', 'expired']
      };

      const allowedNext = validTransitions[booking.status] || [];
      if (!allowedNext.includes(status)) {
        res.status(400).json({ 
          message: `Invalid status transition from '${booking.status}' to '${status}'.` 
        });
        return;
      }

      // Authorization & Ownership Verification
      const isCustomerOwner = req.user?._id && (String(booking.user_id) === String(req.user._id));

      let isAssignedProvider = false;
      if (req.user?.role === 'provider' && booking.provider_id) {
        const prov = await getProviderByUserId(String(req.user._id)).catch(() => null);
        if (prov && String((prov as any)._id) === String(booking.provider_id)) {
          isAssignedProvider = true;
        }
      }

      const providerActions = ['on_the_way', 'arrived', 'reached', 'waiting_start_otp', 'in_progress', 'waiting_end_otp', 'service_completed'];
      const customerActions = ['cancelled', 'rejected'];

      if (providerActions.includes(status)) {
        if (!isAdmin && !isAssignedProvider) {
          res.status(403).json({ message: 'Forbidden: Only the assigned service provider can perform this status update.' });
          return;
        }
      } else if (customerActions.includes(status)) {
        if (!isAdmin && !isCustomerOwner && !isAssignedProvider) {
          res.status(403).json({ message: 'Forbidden: You are not authorized to cancel or reject this booking.' });
          return;
        }
      } else if (!isAdmin) {
        res.status(403).json({ message: 'Forbidden: Administrator privileges required for this transition.' });
        return;
      }

      // Proximity check if reached/arrived
      if (status === 'reached' || status === 'arrived') {
        const { providerLat, providerLng } = req.body;
        const address = booking.address;
        if (providerLat && providerLng && address?.latitude && address?.longitude) {
          const destLat = address.latitude;
          const destLng = address.longitude;
          const R = 6371;
          const dLat = (destLat - providerLat) * Math.PI / 180;
          const dLon = (destLng - providerLng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(providerLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          if (distKm > 0.1) {
            res.status(400).json({ 
              message: `Server-side GPS Validation Failed: You are ${distKm.toFixed(2)} km away from customer location. Must be within 100m.` 
            });
            return;
          }
        }
      }

      const updated = await BookingRepository.atomicStatusTransition(booking.id, [booking.status], status, {}, booking.version);

      if (!updated) {
        res.status(409).json({ message: 'Conflict: booking status already updated' });
        return;
      }

      // Log activity
      await logBookingActivity(
        booking.id,
        `status_update_${status}`,
        (req.user?.role as any) || 'system',
        req.user?._id,
        { previousStatus: booking.status, newStatus: status, reason: req.body.reason }
      );

      res.json(updated);
      return;
    }

    res.json(booking);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign provider to booking (Internal call from provider-service)
// @route   PUT /api/bookings/internal/:id/assign
// @access  Public (Internal)
export const assignProviderInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const result = await withTransaction(db, async (client) => {
      const bRes = await client.query(
        `UPDATE booking.bookings
         SET provider_id = COALESCE(
               (SELECT user_id FROM provider.providers WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
               (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1)
             ),
             status = 'accepted',
             accepted_at = NOW(),
             estimated_distance = COALESCE($3, estimated_distance),
             estimated_travel_minutes = COALESCE($4, estimated_travel_minutes),
             estimated_arrival_time = COALESCE($5, estimated_arrival_time),
             navigation_url = COALESCE($6, navigation_url),
             version = version + 1,
             updated_at = NOW()
         WHERE (id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1)
           AND status IN ('pending', 'provider_searching')
           AND (provider_search_expires_at IS NULL OR provider_search_expires_at > NOW())
         RETURNING *`,
        [
          req.params.id,
          req.body.provider_id,
          req.body.estimatedDistance || null,
          req.body.estimatedTravelMinutes || null,
          req.body.estimatedArrivalTime ? new Date(req.body.estimatedArrivalTime) : null,
          req.body.navigationUrl || null,
        ]
      );

      if (bRes.rows.length === 0) {
        // Idempotency check: is this booking already assigned to THIS EXACT provider?
        const existing = await client.query(
          `SELECT b.*, p.id as provider_id_val, p.user_id as provider_user_id
           FROM booking.bookings b
           LEFT JOIN provider.providers p ON (p.id::text = $2 OR p.user_id::text = $2)
           WHERE (b.id::text = $1 OR b.legacy_mongo_id = $1 OR b.booking_id = $1)
           LIMIT 1`,
          [req.params.id, req.body.provider_id]
        );

        if (existing.rows.length > 0) {
          const row = existing.rows[0];
          const isSameProvider =
            row.provider_id &&
            (String(row.provider_id) === String(req.body.provider_id) ||
             String(row.provider_id) === String(row.provider_id_val) ||
             String(row.provider_id) === String(row.provider_user_id));

          if (isSameProvider && row.status === 'accepted') {
            return mapBookingRow(row);
          }
        }

        throw new Error('BOOKING_ASSIGNMENT_CONFLICT');
      }

      const assignedBooking = mapBookingRow(bRes.rows[0]);

      // Outbox event
      const eventId = `provider.assigned:${assignedBooking.id}:${req.body.provider_id}`;
      await client.query(
        `INSERT INTO booking.event_outbox (event_id, event_type, payload, status)
         VALUES ($1, 'ProviderAssigned', $2, 'PENDING')
         ON CONFLICT (event_id) DO NOTHING`,
        [
          eventId,
          JSON.stringify({
            bookingId: assignedBooking.id,
            bookingDisplayId: assignedBooking.booking_id,
            userId: assignedBooking.user_id,
            providerId: String(req.body.provider_id),
            acceptedAt: new Date().toISOString(),
          })
        ]
      );

      // Activity log
      await client.query(
        `INSERT INTO booking.booking_activities (booking_id, action, actor, details)
         VALUES ($1, 'provider_accepted', 'provider', $2)`,
        [
          assignedBooking.id,
          JSON.stringify({ provider_id: req.body.provider_id, status: 'accepted' })
        ]
      );

      return assignedBooking;
    });

    if (req.body.provider_id) {
      updateProviderStatusInternal(req.body.provider_id.toString(), true, 'busy');
      cacheAcceptedBooking(
        result.id,
        String(req.body.provider_id),
        result.scheduled_at || new Date(),
        18
      ).catch(() => {});

      sendNotification(
        result.user_id,
        'Booking Accepted by Provider',
        `Your booking ${result.booking_id} has been accepted by the provider. They are assigned to your service.`,
        'booking_alert',
        { booking_id: result.id, provider_id: req.body.provider_id.toString() }
      ).catch(err => console.error('[NOTIFICATION] Failed to send provider assigned notification:', err));
    }

    res.json(result);
  } catch (error: any) {
    if (error.message === 'BOOKING_ASSIGNMENT_CONFLICT') {
      res.status(409).json({ message: 'Job already assigned or unavailable' });
      return;
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Compensating unassign provider from booking (Internal call from provider-service on failure)
// @route   PUT /api/bookings/internal/:id/unassign
// @access  Public (Internal)
export const unassignProviderInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider_id, reason, failureReason, failureSource } = req.body;
    if (!provider_id) {
      res.status(400).json({ message: 'provider_id is required for unassign compensation' });
      return;
    }

    const db = getDb();
    const resUpdate = await db.query(
      `UPDATE booking.bookings
       SET status = 'provider_searching',
           provider_id = NULL,
           accepted_at = NULL,
           estimated_distance = NULL,
           estimated_travel_minutes = NULL,
           estimated_arrival_time = NULL,
           navigation_url = NULL,
           version = version + 1,
           updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1)
         AND (provider_id::text = $2 OR provider_id = (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1))
         AND status = 'accepted'
       RETURNING *`,
      [req.params.id, String(provider_id)]
    );

    if (resUpdate.rows.length === 0) {
      res.status(400).json({ 
        message: 'Booking cannot be unassigned (already progressed, reassigned, or invalid state)' 
      });
      return;
    }

    const booking = mapBookingRow(resUpdate.rows[0]);
    await clearBookingCache(booking.id).catch(() => {});
    await logBookingActivity(
      booking.id,
      'provider_unassigned_compensation',
      'system',
      String(provider_id),
      { 
        reason: reason || 'Compensating unassign due to provider transaction failure',
        failureReason: failureReason || 'UNKNOWN',
        failureSource: failureSource || 'infrastructure'
      }
    );

    res.json({ success: true, message: 'Booking unassigned successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (booking.user_id !== req.user?._id && req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    const allowedStatuses = ['pending', 'provider_searching', 'confirmed', 'accepted', 'on_the_way'];
    if (!allowedStatuses.includes(booking.status)) {
      res.status(400).json({ message: `Cannot cancel booking in '${booking.status}' status` });
      return;
    }

    const bookingDateTime = new Date(booking.scheduled_at);
    const diff = bookingDateTime.getTime() - Date.now();
    const oneHour = 60 * 60 * 1000;

    if (diff < oneHour) {
      const membership = await getActiveMembershipFeatures(req.user?._id as string);
      const hasFreeCancellation = membership?.role === 'user' && membership?.userConfig?.freeCancellation === true;

      if (!hasFreeCancellation) {
        res.status(400).json({ message: 'Cancellation window closed (within 1 hour of service)' });
        return;
      }
    }

    const { reason } = req.body;
    const currentVersion = booking.version || 1;

    // ATOMIC cancellation version check
    const updated = await BookingRepository.atomicCancel(booking.id, currentVersion, 'customer', reason);

    if (!updated) {
      res.status(409).json({ message: 'Booking was already modified by another request. Please refresh and retry.' });
      return;
    }

    const bUserId = updated.user_id;
    const bProvId = updated.provider_id;

    sendNotification(
      bUserId,
      'Booking Cancelled',
      `Your booking ${updated.booking_id} has been successfully cancelled.`,
      'booking_alert',
      { booking_id: updated.id }
    ).catch(err => console.error('[NOTIFICATION] Failed to notify user on cancel:', err));

    if (bProvId) {
      sendProviderNotification(
        bProvId,
        'Booking Cancelled by Customer',
        `Booking ${updated.booking_id} has been cancelled by the customer. Reason: ${reason || 'Not provided'}.`,
        'booking_alert',
        { booking_id: updated.id, cancellation_reason: reason }
      ).catch(err => console.error('[NOTIFICATION] Failed to notify provider on cancel:', err));
    }

    // Release coupon redemption
    await CouponRedemptionRepository.deleteByBookingId(updated.id).catch(() => {});

    // Auto-release provider if assigned
    if (updated.provider_id) {
      const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
      axios.post(`${PROV_URL}/api/providers/internal/release`, {
        provider_id: updated.provider_id,
        booking_id: updated.id
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      }).catch(e => console.error('[BOOKING] Failed to release provider on cancel:', e.message));

      // Persist LeadRefundOutbox in PostgreSQL
      const db = getDb();
      await db.query(
        `INSERT INTO booking.lead_refund_outbox (event_id, booking_id, provider_id, amount, reason, status)
         VALUES ($1, $2, $3::uuid, $4, $5, 'PENDING')
         ON CONFLICT (event_id) DO NOTHING`,
        [
          `refund_${updated.id}`,
          updated.id,
          updated.provider_id,
          updated.payable_amount || 0,
          reason || 'Customer cancelled'
        ]
      ).catch(err => console.error('[BOOKING] Failed to create LeadRefundOutbox entry:', err.message));
    }

    sendAdminNotification(
      'Booking Cancelled',
      `Booking ${updated.booking_id} was cancelled by the customer. Reason: ${reason || 'Not provided'}.`,
      'booking_alert',
      { booking_id: updated.id, reason }
    ).catch(console.error);

    res.json({ message: 'Booking cancelled successfully', booking: updated });
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
    const db = getDb();
    const resActive = await db.query(
      `SELECT * FROM booking.bookings
       WHERE (provider_id::text = $1 OR provider_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1))
         AND status IN ('accepted', 'on_the_way', 'arrived', 'waiting_start_otp', 'in_progress', 'waiting_end_otp', 'service_completed')
         AND deleted_at IS NULL
       LIMIT 1`,
      [providerId]
    );

    const activeBooking = resActive.rows[0] ? mapBookingRow(resActive.rows[0]) : null;
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
    const db = getDb();
    const TERMINAL_PAYMENT_STATES = ['paid', 'completed'];

    if (order_id) {
      await db.query(
        `UPDATE booking.orders
         SET status = $1, updated_at = NOW()
         WHERE id::text = $2 OR legacy_mongo_id = $2`,
        [payment_status === 'paid' ? 'completed' : payment_status, order_id]
      );
      await db.query(
        `UPDATE booking.bookings
         SET payment_status = $1,
             payment_id = COALESCE($2::uuid, payment_id),
             payment_link_status = 'linked',
             version = version + 1,
             updated_at = NOW()
         WHERE (order_id::text = $3 OR order_id = (SELECT id FROM booking.orders WHERE id::text = $3 OR legacy_mongo_id = $3 LIMIT 1))
           AND payment_status NOT IN ('paid', 'completed')`,
        [payment_status, payment_id || null, order_id]
      );
    } else if (booking_id) {
      await db.query(
        `UPDATE booking.bookings
         SET payment_status = $1,
             payment_id = COALESCE($2::uuid, payment_id),
             payment_link_status = 'linked',
             version = version + 1,
             updated_at = NOW()
         WHERE (id::text = $3 OR legacy_mongo_id = $3 OR booking_id = $3)
           AND payment_status NOT IN ('paid', 'completed')`,
        [payment_status, payment_id || null, booking_id]
      );
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

    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (booking.user_id !== req.user?._id && req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    const allowedStatuses = ['pending', 'provider_searching', 'accepted'];
    if (!allowedStatuses.includes(booking.status)) {
      res.status(400).json({ message: 'Cannot reschedule booking in current status' });
      return;
    }

    const db = getDb();
    const resUpdate = await db.query(
      `UPDATE booking.bookings
       SET scheduled_at = $1,
           booking_time = COALESCE($2, booking_time),
           version = version + 1,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [new Date(scheduled_at), booking_time || null, booking.id]
    );

    const updated = mapBookingRow(resUpdate.rows[0]);

    sendNotification(
      updated.user_id,
      'Booking Rescheduled',
      `Your booking ${updated.booking_id} has been successfully rescheduled to ${new Date(scheduled_at).toLocaleDateString()} (${booking_time || updated.time_slot}).`,
      'booking_alert',
      { booking_id: updated.id, new_schedule: scheduled_at }
    ).catch(err => console.error('[NOTIFICATION] Failed to notify user on reschedule:', err));

    if (updated.provider_id) {
      sendProviderNotification(
        updated.provider_id,
        'Booking Rescheduled',
        `Booking ${updated.booking_id} has been rescheduled to ${new Date(scheduled_at).toLocaleDateString()} (${booking_time || updated.time_slot}).`,
        'booking_alert',
        { booking_id: updated.id, new_schedule: scheduled_at }
      ).catch(err => console.error('[NOTIFICATION] Failed to notify provider on reschedule:', err));
    }

    res.json({ message: 'Booking rescheduled successfully', booking: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
