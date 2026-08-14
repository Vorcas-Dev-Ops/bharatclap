import { Booking } from '../models/Booking';
import { clearBookingCache } from './bookingCacheService';
import { dispatchBooking } from './bookingDispatchService';
import { expireJobRequestsForBookings, triggerRefundEvaluationInternal, sendNotification, sendProviderNotification } from '../utils/internalApi';
import { RedisKeys } from '../utils/redisKeys';
import { BookingStatus } from '../constants/enums';
import redis from '../config/redis';
import axios from 'axios';
import { logSystem, logUserError } from '@bharatclap/shared';

let workerInterval: NodeJS.Timeout | null = null;
const WORKER_ID = `worker_${Math.random().toString(36).substring(2, 8)}`;

export const processExpiredBookings = async (): Promise<number> => {
  try {
    const graceMinutes = Number(process.env.BOOKING_START_GRACE_MINUTES) || 60;
    const GRACE_PERIOD_MS = graceMinutes * 60 * 1000;
    const now = new Date();
    const cutoff = new Date(now.getTime() - GRACE_PERIOD_MS);
    const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
    const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

    let processedCount = 0;

    // ── 1. Transition unstarted accepted bookings past scheduled time to 'delayed' ──────────
    const delayedBookings = await Booking.find({
      status: BookingStatus.ACCEPTED,
      scheduled_at: { $lt: now, $gte: cutoff },
      started_at: { $exists: false }
    });

    for (const b of delayedBookings) {
      try {
        b.status = 'delayed' as any;
        await b.save();

        await axios.post(`${PROVIDER_SERVICE_URL}/api/internal/emit`, {
          room: String(b.user_id),
          event: 'booking_status_update',
          data: { booking_id: b._id, status: 'delayed', message: 'Provider is running late.' }
        }, { headers: { 'x-internal-service-key': INTERNAL_KEY } }).catch(() => {});

        console.log(`[TIMEOUT WORKER] ⚠️ Booking ${b.booking_id} marked as DELAYED.`);
      } catch (err: any) {
        console.error(`[TIMEOUT WORKER] Error setting delayed status for ${b._id}:`, err.message);
      }
    }

    // ── 2. Transition stale unassigned bookings past grace period to 'unassigned_timeout' ───
    const staleUnassigned = await Booking.find({
      status: { $in: [BookingStatus.PENDING, BookingStatus.PROVIDER_SEARCHING] },
      scheduled_at: { $lt: cutoff }
    });

    for (const booking of staleUnassigned) {
      const ownerToken = `${WORKER_ID}_${Date.now()}`;
      const lockKey = RedisKeys.timeoutLock(String(booking._id));

      try {
        const acquired = await redis.set(lockKey, ownerToken, 'EX', 120, 'NX').catch(() => null);
        if (!acquired) continue;

        booking.status = BookingStatus.UNASSIGNED_TIMEOUT as any;
        booking.cancelled_at = new Date();
        booking.cancellation_reason = `Booking unassigned past grace period of ${graceMinutes} mins`;
        await booking.save();

        // Evict caches
        await clearBookingCache(String(booking._id));
        await redis.del(RedisKeys.jobRequest(String(booking._id)), RedisKeys.bookingETA(String(booking._id))).catch(() => {});

        // Expire JobRequests & release wallet holds in provider-service
        await expireJobRequestsForBookings([String(booking._id)]);

        // Trigger Refund Evaluation
        await triggerRefundEvaluationInternal(String(booking._id), 'unassigned_timeout');

        // Notify socket
        await axios.post(`${PROVIDER_SERVICE_URL}/api/internal/emit`, {
          room: String(booking.user_id),
          event: 'booking_status_update',
          data: { booking_id: booking._id, status: 'unassigned_timeout', message: 'No provider was assigned for your requested timeslot.' }
        }, { headers: { 'x-internal-service-key': INTERNAL_KEY } }).catch(() => {});

        console.log(`[TIMEOUT WORKER] ⌛ Stale unassigned booking ${booking.booking_id} transitioned to UNASSIGNED_TIMEOUT.`);
        processedCount++;

        // Safely release lock if owner
        const currentLock = await redis.get(lockKey);
        if (currentLock === ownerToken) await redis.del(lockKey);
      } catch (err: any) {
        console.error(`[TIMEOUT WORKER ERROR] Failed processing stale unassigned booking ${booking._id}:`, err.message);
        logSystem(`Timeout worker error: ${booking.booking_id}`, { error_code: 'TIMEOUT_WORKER_ERROR', stack: err.stack, meta: { booking_id: String(booking._id) } });
      }
    }

    // ── 3. Find accepted/delayed bookings past grace period that were never started ────────
    const expiredBookings = await Booking.find({
      status: { $in: [BookingStatus.ACCEPTED, 'delayed', BookingStatus.WAITING_START_OTP] },
      scheduled_at: { $lt: cutoff },
      started_at: { $exists: false }
    });

    for (const booking of expiredBookings) {
      const ownerToken = `${WORKER_ID}_${Date.now()}`;
      const lockKey = RedisKeys.timeoutLock(String(booking._id));

      try {
        const acquired = await redis.set(lockKey, ownerToken, 'EX', 120, 'NX').catch(() => null);
        if (!acquired) {
          console.log(`[TIMEOUT WORKER] 🔒 Redispatch lock active for ${booking._id}, skipping.`);
          continue;
        }

        // Expire JobRequests in provider service
        await expireJobRequestsForBookings([String(booking._id)]);

        // Record provider history
        if (booking.provider_id) {
          if (!booking.previous_providers) booking.previous_providers = [];
          booking.previous_providers.push({
            provider_id: booking.provider_id,
            accepted_at: booking.accepted_at || booking.createdAt,
            unassigned_at: new Date(),
            reason: `Service not started within ${graceMinutes}-min grace period`
          });
        }

        const maxAttempts = booking.max_redispatch_attempts || Number(process.env.MAX_REDISPATCH_ATTEMPTS) || 3;
        const currentAttempts = (booking.redispatch_count || 0) + 1;
        booking.redispatch_count = currentAttempts;
        booking.last_redispatch_at = new Date();

        if (currentAttempts > maxAttempts) {
          // Limit exceeded: transition to unassigned_timeout & trigger refund policy evaluation
          booking.status = BookingStatus.UNASSIGNED_TIMEOUT as any;
          booking.cancelled_at = new Date();
          booking.cancellation_reason = `Exceeded maximum redispatch attempts (${currentAttempts - 1}/${maxAttempts})`;
          booking.provider_id = undefined as any;
          await booking.save();

          await clearBookingCache(String(booking._id));
          await redis.del(RedisKeys.jobRequest(String(booking._id)), RedisKeys.bookingETA(String(booking._id))).catch(() => {});

          await triggerRefundEvaluationInternal(String(booking._id), 'max_redispatch_exceeded');

          console.log(`[TIMEOUT WORKER] ⛔ Booking ${booking.booking_id} reached MAX redispatch attempts (${maxAttempts}). Triggered refund evaluation.`);
          processedCount++;

          const currentLock = await redis.get(lockKey);
          if (currentLock === ownerToken) await redis.del(lockKey);
          continue;
        }

        // Active redispatch attempt
        booking.status = BookingStatus.EXPIRED as any;
        booking.cancelled_at = new Date();
        booking.cancellation_reason = `Booking expired: provider missed start window (Attempt ${currentAttempts}/${maxAttempts})`;
        booking.provider_id = undefined as any;
        await booking.save();

        await clearBookingCache(String(booking._id));
        await redis.del(RedisKeys.jobRequest(String(booking._id)), RedisKeys.bookingETA(String(booking._id))).catch(() => {});

        // Emit socket notification
        await axios.post(`${PROVIDER_SERVICE_URL}/api/internal/emit`, {
          room: String(booking.user_id),
          event: 'booking_status_update',
          data: { booking_id: booking._id, status: 'expired', message: `Finding replacement provider (Attempt ${currentAttempts}/${maxAttempts})...` }
        }, { headers: { 'x-internal-service-key': INTERNAL_KEY } }).catch(() => {});

        // Auto-reassign: dispatch to replacement providers
        dispatchBooking(String(booking._id)).catch(err => {
          console.error(`[TIMEOUT WORKER] Re-dispatch failed for ${booking._id}:`, err.message);
        });

        console.log(`[TIMEOUT WORKER] ⏰ Booking ${booking.booking_id} marked as EXPIRED & re-dispatched (${currentAttempts}/${maxAttempts}).`);
        processedCount++;

        const currentLock = await redis.get(lockKey);
        if (currentLock === ownerToken) await redis.del(lockKey);
      } catch (err: any) {
        console.error(`[TIMEOUT WORKER ERROR] Failed processing expired booking ${booking._id}:`, err.message);
      }
    }

    // ── 4. Service reminder before scheduled time (60-minute window) ───────────────────
    try {
      const reminderWindow = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const upcomingBookings = await Booking.find({
        status: BookingStatus.ACCEPTED,
        scheduled_at: { $gt: now, $lte: reminderWindow }
      });

      for (const booking of upcomingBookings) {
        const redisKey = `booking:reminder:${booking._id}`;
        // Try to set key in Redis with 2-hour TTL to ensure we send the reminder exactly once
        const lock = await redis.set(redisKey, 'sent', 'EX', 7200, 'NX').catch(() => null);
        if (lock) {
          const formattedTime = booking.booking_time || 'scheduled time';
          
          // Send user reminder
          sendNotification(
            booking.user_id.toString(),
            'Service Reminder',
            `Reminder: Your service booking ${booking.booking_id} is scheduled for today at ${formattedTime}.`,
            'booking_alert',
            { booking_id: booking._id }
          ).catch(() => {});

          // Send provider reminder
          if (booking.provider_id) {
            sendProviderNotification(
              booking.provider_id.toString(),
              'Service Reminder',
              `Reminder: You have an upcoming service booking ${booking.booking_id} scheduled at ${formattedTime} today.`,
              'booking_alert',
              { booking_id: booking._id }
            ).catch(() => {});
          }
        }
      }
    } catch (reminderErr: any) {
      console.error('[TIMEOUT WORKER] Upcoming service reminders error:', reminderErr.message);
    }

    return processedCount;
  } catch (error: any) {
    console.error('[TIMEOUT WORKER ERROR]', error?.message || error);
    return 0;
  }
};

export const startTimeoutWorker = (intervalMs: number = 60000): void => {
  if (workerInterval) return;
  console.log('[TIMEOUT WORKER] 🚀 Started accepted & unassigned booking timeout worker (1-minute interval)');
  
  processExpiredBookings().catch(console.error);

  workerInterval = setInterval(() => {
    processExpiredBookings().catch(console.error);
  }, intervalMs);
};

export const stopTimeoutWorker = (): void => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
};
