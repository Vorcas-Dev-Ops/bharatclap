import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";
import { Booking } from "./models/Booking";
import { sendAdminNotification } from "./utils/internalApi";
import mongoose from 'mongoose';
import { closeQueue } from './services/bookingDispatchService';
import { setupLifecycle } from "./utils/lifecycle";

dotenv.config();
connectDB();

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
  intervals: [recoveryTimer],
});
