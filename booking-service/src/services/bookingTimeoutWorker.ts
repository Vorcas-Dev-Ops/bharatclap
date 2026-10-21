import { clearBookingCache } from './bookingCacheService';
import { dispatchBooking } from './bookingDispatchService';
import { expireJobRequestsForBookings, triggerRefundEvaluationInternal, sendNotification, sendProviderNotification } from '../utils/internalApi';
import { RedisKeys } from '../utils/redisKeys';
import { BookingStatus } from '../constants/enums';
import redis from '../config/redis';
import { logSystem, getInternalServiceKey } from '@bharatclap/shared';
import { getDb } from '../config/db';
import { mapBookingRow } from '../repositories/bookingRepository';
import { logBookingActivity } from '../utils/activityLogger';
import axios from 'axios';

let workerInterval: NodeJS.Timeout | null = null;
const WORKER_ID = `worker_${Math.random().toString(36).substring(2, 8)}`;

export const processExpiredBookings = async (): Promise<number> => {
  try {
    const graceMinutes = Number(process.env.BOOKING_START_GRACE_MINUTES) || 60;
    const GRACE_PERIOD_MS = graceMinutes * 60 * 1000;
    const now = new Date();
    const cutoff = new Date(now.getTime() - GRACE_PERIOD_MS);
    const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
    const INTERNAL_KEY = getInternalServiceKey();
    const db = getDb();

    let processedCount = 0;

    // 1. Transition unstarted accepted bookings past scheduled time to 'delayed'
    const delayedRes = await db.query(
      `SELECT * FROM booking.bookings
       WHERE status = 'accepted'
         AND scheduled_at < $1
         AND scheduled_at >= $2
         AND started_at IS NULL
         AND deleted_at IS NULL`,
      [now, cutoff]
    );

    for (const row of delayedRes.rows) {
      const b = mapBookingRow(row);
      try {
        await db.query(
          `UPDATE booking.bookings SET status = 'delayed', version = version + 1, updated_at = NOW() WHERE id = $1`,
          [b.id]
        );

        await axios.post(`${PROVIDER_SERVICE_URL}/api/internal/emit`, {
          room: String(b.user_id),
          event: 'booking_status_update',
          data: { booking_id: b.id, status: 'delayed', message: 'Provider is running late.' }
        }, { headers: { 'x-internal-service-key': INTERNAL_KEY } }).catch(() => {});

        console.log(`[TIMEOUT WORKER] ⚠️ Booking ${b.booking_id} marked as DELAYED.`);
      } catch (err: any) {
        console.error(`[TIMEOUT WORKER] Error setting delayed status for ${b.id}:`, err.message);
      }
    }

    // 2. Transition stale unassigned bookings to 'unassigned_timeout'
    const staleRes = await db.query(
      `SELECT * FROM booking.bookings
       WHERE status IN ('pending', 'provider_searching')
         AND provider_id IS NULL
         AND deleted_at IS NULL
         AND (
           (provider_search_expires_at IS NOT NULL AND provider_search_expires_at <= $1)
           OR (provider_search_expires_at IS NULL AND scheduled_at < $2)
         )`,
      [now, cutoff]
    );

    for (const row of staleRes.rows) {
      const booking = mapBookingRow(row);
      const ownerToken = `${WORKER_ID}_${Date.now()}`;
      const lockKey = RedisKeys.timeoutLock(String(booking.id));

      try {
        const acquired = await redis.set(lockKey, ownerToken, 'EX', 120, 'NX').catch(() => null);
        if (!acquired) continue;

        // Atomic transition
        const updatedRes = await db.query(
          `UPDATE booking.bookings
           SET status = 'unassigned_timeout',
               cancelled_at = NOW(),
               cancellation_reason = 'No provider accepted within the search window',
               version = version + 1,
               updated_at = NOW()
           WHERE id = $1 AND status IN ('pending', 'provider_searching')
           RETURNING *`,
          [booking.id]
        );

        if (updatedRes.rows.length === 0) {
          const currentLock = await redis.get(lockKey);
          if (currentLock === ownerToken) await redis.del(lockKey);
          continue;
        }

        await clearBookingCache(String(booking.id));
        await redis.del(RedisKeys.jobRequest(String(booking.id)), RedisKeys.bookingETA(String(booking.id))).catch(() => {});

        await expireJobRequestsForBookings([String(booking.id)]);
        await triggerRefundEvaluationInternal(String(booking.id), 'PROVIDER_SEARCH_TIMEOUT');

        await axios.post(`${PROVIDER_SERVICE_URL}/api/internal/emit`, {
          room: String(booking.user_id),
          event: 'booking_status_update',
          data: { booking_id: booking.id, status: 'unassigned_timeout', message: 'Sorry! We couldn\'t find a provider. Please try another time.' }
        }, { headers: { 'x-internal-service-key': INTERNAL_KEY } }).catch(() => {});

        console.log(`[TIMEOUT WORKER] ⌛ Stale unassigned booking ${booking.booking_id} transitioned to UNASSIGNED_TIMEOUT.`);
        processedCount++;

        const currentLock = await redis.get(lockKey);
        if (currentLock === ownerToken) await redis.del(lockKey);
      } catch (err: any) {
        console.error(`[TIMEOUT WORKER ERROR] Failed processing stale unassigned booking ${booking.id}:`, err.message);
        logSystem(`Timeout worker error: ${booking.booking_id}`, { error_code: 'TIMEOUT_WORKER_ERROR', stack: err.stack, meta: { booking_id: String(booking.id) } });
      }
    }

    // 3. Find accepted/delayed bookings past grace period that were never started
    const expiredRes = await db.query(
      `SELECT * FROM booking.bookings
       WHERE status IN ('accepted', 'delayed', 'waiting_start_otp')
         AND scheduled_at < $1
         AND started_at IS NULL
         AND deleted_at IS NULL`,
      [cutoff]
    );

    for (const row of expiredRes.rows) {
      const booking = mapBookingRow(row);
      const ownerToken = `${WORKER_ID}_${Date.now()}`;
      const lockKey = RedisKeys.timeoutLock(String(booking.id));

      try {
        const acquired = await redis.set(lockKey, ownerToken, 'EX', 120, 'NX').catch(() => null);
        if (!acquired) {
          console.log(`[TIMEOUT WORKER] 🔒 Redispatch lock active for ${booking.id}, skipping.`);
          continue;
        }

        await expireJobRequestsForBookings([String(booking.id)]);

        // Record provider history, release lead fee, and log audit trail
        if (booking.provider_id) {
          await db.query(
            `INSERT INTO booking.booking_previous_providers (booking_id, provider_id, accepted_at, unassigned_at, reason)
             VALUES ($1, (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1), $3, NOW(), $4)`,
            [booking.id, booking.provider_id, booking.accepted_at || booking.created_at, `Service not started within ${graceMinutes}-min grace period`]
          ).catch(() => {});

          await db.query(
            `INSERT INTO booking.lead_refund_outbox (event_id, booking_id, provider_id, status)
             VALUES ($1, $2, $3::uuid, 'PENDING')
             ON CONFLICT (event_id) DO NOTHING`,
            [`lead_refund_${booking.id}_${booking.provider_id}_timeout`, booking.id, booking.provider_id]
          ).catch(e => console.error('[TIMEOUT WORKER] Failed to enqueue lead refund outbox:', e.message));

          await logBookingActivity(
            booking.id,
            'PROVIDER_UNASSIGNED_TIMEOUT',
            'system',
            undefined,
            { provider_id: booking.provider_id, reason: `Service not started within ${graceMinutes}-min grace period` }
          ).catch(() => {});
        }

        const maxAttempts = Number(process.env.MAX_REDISPATCH_ATTEMPTS) || 3;
        const currentAttempts = (Number(row.redispatch_count) || 0) + 1;

        if (currentAttempts > maxAttempts) {
          await db.query(
            `UPDATE booking.bookings
             SET status = 'unassigned_timeout',
                 cancelled_at = NOW(),
                 cancellation_reason = $1,
                 provider_id = NULL,
                 redispatch_count = $2,
                 last_redispatch_at = NOW(),
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $3`,
            [`Exceeded maximum redispatch attempts (${currentAttempts - 1}/${maxAttempts})`, currentAttempts, booking.id]
          );

          await clearBookingCache(String(booking.id));
          await redis.del(RedisKeys.jobRequest(String(booking.id)), RedisKeys.bookingETA(String(booking.id))).catch(() => {});

          await logBookingActivity(
            booking.id,
            'BOOKING_UNASSIGNED_TIMEOUT',
            'system',
            undefined,
            { attempts: currentAttempts - 1, max_attempts: maxAttempts, reason: 'Exceeded maximum redispatch attempts' }
          ).catch(() => {});

          await triggerRefundEvaluationInternal(String(booking.id), 'MAX_REDISPATCH_EXCEEDED');

          console.log(`[TIMEOUT WORKER] ⛔ Booking ${booking.booking_id} reached MAX redispatch attempts (${maxAttempts}). Triggered refund evaluation.`);
          processedCount++;

          const currentLock = await redis.get(lockKey);
          if (currentLock === ownerToken) await redis.del(lockKey);
          continue;
        }

        // Active redispatch attempt
        await db.query(
          `UPDATE booking.bookings
           SET status = 'expired',
               cancelled_at = NOW(),
               cancellation_reason = $1,
               provider_id = NULL,
               redispatch_count = $2,
               last_redispatch_at = NOW(),
               version = version + 1,
               updated_at = NOW()
           WHERE id = $3`,
          [`Booking expired: provider missed start window (Attempt ${currentAttempts}/${maxAttempts})`, currentAttempts, booking.id]
        );

        await clearBookingCache(String(booking.id));
        await redis.del(RedisKeys.jobRequest(String(booking.id)), RedisKeys.bookingETA(String(booking.id))).catch(() => {});

        await logBookingActivity(
          booking.id,
          'BOOKING_EXPIRED_REDISPATCH',
          'system',
          undefined,
          { attempt: currentAttempts, max_attempts: maxAttempts, reason: 'Provider missed start window' }
        ).catch(() => {});

        await axios.post(`${PROVIDER_SERVICE_URL}/api/internal/emit`, {
          room: String(booking.user_id),
          event: 'booking_status_update',
          data: { booking_id: booking.id, status: 'expired', message: `Finding replacement provider (Attempt ${currentAttempts}/${maxAttempts})...` }
        }, { headers: { 'x-internal-service-key': INTERNAL_KEY } }).catch(() => {});

        dispatchBooking(String(booking.id)).catch(err => {
          console.error(`[TIMEOUT WORKER] Re-dispatch failed for ${booking.id}:`, err.message);
        });

        console.log(`[TIMEOUT WORKER] ⏰ Booking ${booking.booking_id} marked as EXPIRED & re-dispatched (${currentAttempts}/${maxAttempts}).`);
        processedCount++;

        const currentLock = await redis.get(lockKey);
        if (currentLock === ownerToken) await redis.del(lockKey);
      } catch (err: any) {
        console.error(`[TIMEOUT WORKER ERROR] Failed processing expired booking ${booking.id}:`, err.message);
      }
    }

    // 4. Service reminder before scheduled time (60-minute window)
    try {
      const reminderWindow = new Date(Date.now() + 60 * 60 * 1000);
      const upcomingRes = await db.query(
        `SELECT * FROM booking.bookings
         WHERE status = 'accepted'
           AND scheduled_at > $1
           AND scheduled_at <= $2
           AND deleted_at IS NULL`,
        [now, reminderWindow]
      );

      for (const row of upcomingRes.rows) {
        const booking = mapBookingRow(row);
        const redisKey = `booking:reminder:${booking.id}`;
        const lock = await redis.set(redisKey, 'sent', 'EX', 7200, 'NX').catch(() => null);
        if (lock) {
          const formattedTime = booking.time_slot || 'scheduled time';
          sendNotification(
            booking.user_id.toString(),
            'Service Reminder',
            `Reminder: Your service booking ${booking.booking_id} is scheduled for today at ${formattedTime}.`,
            'booking_alert',
            { booking_id: booking.id }
          ).catch(() => {});

          if (booking.provider_id) {
            sendProviderNotification(
              booking.provider_id.toString(),
              'Service Reminder',
              `Reminder: You have an upcoming service booking ${booking.booking_id} scheduled at ${formattedTime} today.`,
              'booking_alert',
              { booking_id: booking.id }
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
