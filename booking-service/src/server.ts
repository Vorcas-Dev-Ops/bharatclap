import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";
import { Booking } from "./models/Booking";
import { sendAdminNotification } from "./utils/internalApi";
import mongoose from 'mongoose';
import { closeQueue } from './services/bookingDispatchService';
import { setupLifecycle } from "./utils/lifecycle";
import { startTimeoutWorker } from "./services/bookingTimeoutWorker";
import axios from 'axios';

import { startLeadRefundOutboxPoller } from "./services/leadRefundOutboxPoller";
import { startSettlementOutboxPoller } from "./services/settlementOutboxPoller";

dotenv.config();
connectDB();
startTimeoutWorker();
const outboxTimer = startLeadRefundOutboxPoller();
const settlementOutboxTimer = startSettlementOutboxPoller();

let recoveryTimer: NodeJS.Timeout | null = null;

const startRecoveryJobs = () => {
  recoveryTimer = setInterval(async () => {
    try {
      const now = new Date();

      const stuckAccepted = await Booking.find({
        status: 'accepted',
        accepted_at: { $lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) }
      }).lean();

      for (const b of stuckAccepted) {
        console.warn(`[RECOVERY] Booking ${b.booking_id} stuck in 'accepted' for >2h`);
        sendAdminNotification('Stuck Booking', `Booking ${b.booking_id} has been accepted but not started for over 2 hours.`, 'booking_alert', { booking_id: b._id }).catch(() => {});
      }

      const stuckStartOtp = await Booking.find({
        status: 'waiting_start_otp',
        startOtpGeneratedAt: { $lt: new Date(now.getTime() - 30 * 60 * 1000) }
      });

      for (const b of stuckStartOtp) {
        console.warn(`[RECOVERY] Booking ${b.booking_id} start OTP expired (>30min) — clearing`);
        b.startOtp = undefined;
        b.startOtpGeneratedAt = undefined;
        b.startOtpAttempts = 0;
        b.status = 'accepted';
        await b.save();
      }

      const stuckEndOtp = await Booking.find({
        status: 'waiting_end_otp',
        endOtpGeneratedAt: { $lt: new Date(now.getTime() - 3 * 60 * 60 * 1000) }
      }).lean();

      for (const b of stuckEndOtp) {
        console.warn(`[RECOVERY] Booking ${b.booking_id} stuck in 'waiting_end_otp' for >3h`);
        sendAdminNotification('Stuck Booking (End OTP)', `Booking ${b.booking_id} has been in waiting_end_otp for over 3 hours.`, 'booking_alert', { booking_id: b._id }).catch(() => {});
      }

      // Payment collection expiry: release providers held for expired COD payments
      const expiredPayments = await Booking.find({
        status: 'service_completed',
        'payment_collection.status': { $in: ['pending', 'upi_pending'] },
        'payment_collection.expires_at': { $lt: now },
      });

      for (const b of expiredPayments) {
        console.warn(`[RECOVERY] Booking ${b.booking_id} payment expired — releasing provider`);
        (b as any).payment_collection.status = 'expired';
        await b.save();

        // Release provider
        if (b.provider_id) {
          const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
          axios.post(`${PROV_URL}/api/providers/internal/release`, {
            provider_id: b.provider_id,
          }, {
            headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
          }).catch(e => console.error(`[RECOVERY] Failed to release provider for expired payment ${b.booking_id}:`, e.message));
        }

        // Audit log
        const { PaymentCollectionAudit } = await import('./models/PaymentCollectionAudit');
        PaymentCollectionAudit.create({
          booking_id: b._id, action: 'expired', actor: 'system', timestamp: now,
        }).catch(console.error);
        PaymentCollectionAudit.create({
          booking_id: b._id, action: 'provider_released', actor: 'system', timestamp: now,
        }).catch(console.error);

        sendAdminNotification(
          'Payment Expired',
          `Booking ${b.booking_id} payment expired after 24h. Amount: ₹${(b as any).payment_collection?.final_amount || b.payable_amount}. Provider released. Please follow up.`,
          'payment_alert',
          { booking_id: b._id }
        ).catch(() => {});
      }

    } catch (err: any) {
      console.error('[RECOVERY] Job error:', err.message);
    }
  }, 5 * 60 * 1000);
};

startRecoveryJobs();

const PORT = Number(process.env.PORT) || 5004;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOOKING-SERVICE] 🚀 Booking Service listening on Port ${PORT}`);
});

setupLifecycle({
  serviceName: 'BOOKING-SERVICE',
  port: PORT,
  server,
  mongoose,
  queues: [{ close: closeQueue }],
  intervals: [recoveryTimer, outboxTimer, settlementOutboxTimer].filter(Boolean) as NodeJS.Timeout[],
});
