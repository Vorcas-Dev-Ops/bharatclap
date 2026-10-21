import dotenv from "dotenv";
dotenv.config();

// Reload trigger: restarted with retry-aware pg pool

import app from "./app";
import { connectDB, getDb } from "./config/db";
import { sendAdminNotification } from "./utils/internalApi";
import { closeQueue } from './services/bookingDispatchService';
import { setupLifecycle } from "./utils/lifecycle";
import { startTimeoutWorker } from "./services/bookingTimeoutWorker";
import axios from 'axios';

import { startLeadRefundOutboxPoller } from "./services/leadRefundOutboxPoller";
import { startSettlementOutboxPoller } from "./services/settlementOutboxPoller";
import { startEventOutboxPoller } from "./services/eventOutboxPoller";
import { startRatingOutboxPoller } from "./services/ratingOutboxPoller";
import { eventBus } from '@bharatclap/shared';
import redis from './config/redis';
import { PaymentCollectionAuditRepository } from './repositories/paymentCollectionAuditRepository';

dotenv.config();

let recoveryTimer: NodeJS.Timeout | null = null;
let outboxTimer: NodeJS.Timeout | null = null;
let settlementOutboxTimer: NodeJS.Timeout | null = null;
let eventOutboxTimer: NodeJS.Timeout | null = null;
let ratingOutboxTimer: NodeJS.Timeout | null = null;

const startServer = async () => {
  const pool = await connectDB();
  eventBus.init(redis);
  startTimeoutWorker();
  outboxTimer = startLeadRefundOutboxPoller();
  settlementOutboxTimer = startSettlementOutboxPoller();
  eventOutboxTimer = startEventOutboxPoller();
  ratingOutboxTimer = startRatingOutboxPoller();
  startRecoveryJobs();

  const PORT = Number(process.env.PORT) || 5004;

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BOOKING-SERVICE] 🚀 Booking Service listening on Port ${PORT}`);
  });

  setupLifecycle({
    serviceName: 'BOOKING-SERVICE',
    port: PORT,
    server,
    pgPool: pool,
    queues: [{ close: closeQueue }, { close: () => eventBus.shutdown() }],
    intervals: [recoveryTimer, outboxTimer, settlementOutboxTimer, eventOutboxTimer, ratingOutboxTimer].filter(Boolean) as NodeJS.Timeout[],
  });
};

const startRecoveryJobs = () => {
  recoveryTimer = setInterval(async () => {
    try {
      const now = new Date();
      const db = getDb();

      // Stuck accepted > 2h
      const stuckAcceptedRes = await db.query(
        `SELECT id, booking_id FROM booking.bookings
         WHERE status = 'accepted'
           AND accepted_at < $1
           AND deleted_at IS NULL`,
        [new Date(now.getTime() - 2 * 60 * 60 * 1000)]
      );

      for (const b of stuckAcceptedRes.rows) {
        console.warn(`[RECOVERY] Booking ${b.booking_id} stuck in 'accepted' for >2h`);
        sendAdminNotification('Stuck Booking', `Booking ${b.booking_id} has been accepted but not started for over 2 hours.`, 'booking_alert', { booking_id: b.id }).catch(() => {});
      }

      // Stuck start OTP > 30 min
      await db.query(
        `UPDATE booking.bookings
         SET start_otp = NULL,
             start_otp_generated_at = NULL,
             start_otp_attempts = 0,
             status = 'accepted',
             version = version + 1,
             updated_at = NOW()
         WHERE status = 'waiting_start_otp'
           AND start_otp_generated_at < $1
           AND deleted_at IS NULL`,
        [new Date(now.getTime() - 30 * 60 * 1000)]
      );

      // Stuck end OTP > 3h
      const stuckEndRes = await db.query(
        `SELECT id, booking_id FROM booking.bookings
         WHERE status = 'waiting_end_otp'
           AND end_otp_generated_at < $1
           AND deleted_at IS NULL`,
        [new Date(now.getTime() - 3 * 60 * 60 * 1000)]
      );

      for (const b of stuckEndRes.rows) {
        console.warn(`[RECOVERY] Booking ${b.booking_id} stuck in 'waiting_end_otp' for >3h`);
        sendAdminNotification('Stuck Booking (End OTP)', `Booking ${b.booking_id} has been in waiting_end_otp for over 3 hours.`, 'booking_alert', { booking_id: b.id }).catch(() => {});
      }

      // Expired payments
      const expiredPaymentsRes = await db.query(
        `SELECT b.id, b.booking_id, b.provider_id, b.payable_amount, pc.final_amount
         FROM booking.bookings b
         JOIN booking.booking_payment_collections pc ON pc.booking_id = b.id
         WHERE b.status = 'service_completed'
           AND pc.status IN ('pending', 'upi_pending')
           AND pc.expires_at < $1
           AND b.deleted_at IS NULL`,
        [now]
      );

      for (const b of expiredPaymentsRes.rows) {
        console.warn(`[RECOVERY] Booking ${b.booking_id} payment expired — releasing provider`);
        await db.query(
          `UPDATE booking.booking_payment_collections SET status = 'expired', updated_at = NOW() WHERE booking_id = $1`,
          [b.id]
        );

        if (b.provider_id) {
          const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
          axios.post(`${PROV_URL}/api/providers/internal/release`, {
            provider_id: b.provider_id,
          }, {
            headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
          }).catch(e => console.error(`[RECOVERY] Failed to release provider for expired payment ${b.booking_id}:`, e.message));
        }

        await PaymentCollectionAuditRepository.log({
          bookingId: b.id, action: 'expired', actor: 'system', timestamp: now,
        });
        await PaymentCollectionAuditRepository.log({
          bookingId: b.id, action: 'provider_released', actor: 'system', timestamp: now,
        });

        sendAdminNotification(
          'Payment Expired',
          `Booking ${b.booking_id} payment expired after 24h. Provider released. Please follow up.`,
          'payment_alert',
          { booking_id: b.id }
        ).catch(() => {});
      }
    } catch (err: any) {
      console.error('[RECOVERY] Job error:', err.message);
    }
  }, 5 * 60 * 1000);
};

startServer().catch(err => {
  console.error('[BOOKING-SERVICE] Fatal startup error:', err);
  process.exit(1);
});
