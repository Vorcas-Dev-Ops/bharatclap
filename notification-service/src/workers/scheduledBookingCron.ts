import axios from 'axios';
import { Notification } from '../models/Notification';
import { SystemSetting } from '../models/SystemSetting';

const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

export function startScheduledBookingCron() {
  console.log('⏰ [CRON WORKER] Starting Scheduled Booking Multi-Stage Reminder & Safeguard Cron...');

  const runCheck = async () => {
    try {
      const readySetting = await SystemSetting.findOne({ key: 'ready_confirmation_lead_hours' }).lean();
      const gpsCheckSetting = await SystemSetting.findOne({ key: 'gps_check_lead_mins' }).lean();

      const readyHours = readySetting?.value ?? 2;
      const gpsMins = gpsCheckSetting?.value ?? 15;

      const now = new Date();

      const res = await axios.get(`${BOOKING_SERVICE_URL}/api/bookings?page=1&limit=100`, {
        headers: { 'x-internal-service-key': INTERNAL_KEY }
      }).catch(() => null);

      const bookings = res?.data?.data || [];
      if (bookings.length === 0) return;

      for (const booking of bookings) {
        if (!['scheduled', 'confirmed', 'provider_accepted', 'ready_confirmed'].includes(booking.status)) {
          continue;
        }

        const scheduledTime = new Date(booking.scheduled_at).getTime();
        const diffMs = scheduledTime - now.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));

        // 1. 2-Hour "I'm Ready" Alert for Provider
        if (diffMins > (readyHours * 60 - 15) && diffMins <= (readyHours * 60 + 5) && booking.status !== 'ready_confirmed') {
          if (booking.provider_id?._id || booking.provider_id) {
            const pId = booking.provider_id._id || booking.provider_id;
            await Notification.create({
              recipient_id: pId,
              recipient_type: 'Provider',
              title: 'Upcoming Service - Confirm Readiness',
              message: `You have a booking scheduled in ${readyHours} hours for ${booking.subservice_id?.subservice_name || 'Service'}. Tap "I'm Ready" to confirm.`,
              type: 'booking_alert',
              metadata: { booking_id: booking.booking_id, action: 'confirm_ready', priority: 'high' }
            }).catch(() => {});
          }
        }

        // 2. 30-Minute Travel Reminder
        if (diffMins > 25 && diffMins <= 35) {
          if (booking.provider_id?._id || booking.provider_id) {
            const pId = booking.provider_id._id || booking.provider_id;
            await Notification.create({
              recipient_id: pId,
              recipient_type: 'Provider',
              title: 'Service starts in 30 minutes',
              message: 'Please start traveling to the customer location.',
              type: 'booking_alert',
              metadata: { booking_id: booking.booking_id, action: 'start_trip' }
            }).catch(() => {});
          }
        }

        // 3. 15-Minute Safeguard & Emergency Backup Trigger
        if (diffMins > 0 && diffMins <= gpsMins) {
          const isUnconfirmed = booking.status !== 'ready_confirmed' && booking.status !== 'on_the_way' && booking.status !== 'arrived';
          
          if (isUnconfirmed) {
            console.warn(`⚠️ [SCHEDULED SAFEGUARD] Booking #${booking.booking_id} is unconfirmed ${diffMins} mins before start! Triggering Admin alert.`);
            
            await Notification.create({
              recipient_type: 'Admin',
              title: `⚠️ At-Risk Scheduled Booking #${booking.booking_id}`,
              message: `Provider unconfirmed ${diffMins} mins before appointment. Standby backup dispatch recommended.`,
              type: 'admin_alert',
              metadata: { booking_id: booking.booking_id, priority: 'high', risk_level: 'high' }
            }).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      console.error('[SCHEDULED CRON ERROR]', err.message);
    }
  };

  // Run initial check immediately, then schedule every 60 seconds
  runCheck();
  setInterval(runCheck, 60000);
}
