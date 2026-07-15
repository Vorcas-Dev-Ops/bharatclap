import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import { Booking } from "./models/Booking";
import { sendAdminNotification, sendNotification } from "./utils/internalApi";
import axios from "axios";

import mongoose from 'mongoose';
import { closeQueue } from './services/bookingDispatchService';

dotenv.config();

connectDB();

// ─── Recovery job: detect and fix stuck bookings every 5 minutes ─────────────
const startRecoveryJobs = () => {
  setInterval(async () => {
    try {
      const now = new Date();

      // 1. Accepted > 2h but never started
      const stuckAccepted = await Booking.find({
        status: 'accepted',
        accepted_at: { $lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) }
      }).lean();

      for (const b of stuckAccepted) {
        console.warn(`[RECOVERY] Booking ${b.booking_id} stuck in 'accepted' for >2h`);
        sendAdminNotification('Stuck Booking', `Booking ${b.booking_id} has been accepted but not started for over 2 hours.`, 'booking_alert', { booking_id: b._id }).catch(() => {});
      }

      // 2. Waiting start OTP > 30min — expire OTP, allow regeneration
      const stuckStartOtp = await Booking.find({
        status: 'waiting_start_otp',
        startOtpGeneratedAt: { $lt: new Date(now.getTime() - 30 * 60 * 1000) }
      });

      for (const b of stuckStartOtp) {
        console.warn(`[RECOVERY] Booking ${b.booking_id} start OTP expired (>30min) — clearing`);
        b.startOtp = undefined;
        b.startOtpGeneratedAt = undefined;
        b.startOtpAttempts = 0;
        b.status = 'accepted'; // Allow provider to re-trigger start-service
        await b.save();
      }

      // 3. Waiting end OTP > 3h — alert admin
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
  }, 5 * 60 * 1000); // every 5 minutes
};

startRecoveryJobs();

const PORT = process.env.PORT || 5004;

const server = app.listen(PORT, () => {
  console.log(`Booking Service running on ${PORT}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`[BOOKING-SERVICE] ⚠️ ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[BOOKING-SERVICE] 🛑 HTTP server closed.');
    try {
      await closeQueue();
      await mongoose.connection.close();
      console.log('[BOOKING-SERVICE] 🍃 MongoDB connection closed.');
      process.exit(0);
    } catch (err: any) {
      console.error('[BOOKING-SERVICE] ❌ Error during shutdown:', err.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[BOOKING-SERVICE] ⚠️ Force exit after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
