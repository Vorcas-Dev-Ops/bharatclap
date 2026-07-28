import { JobRequest } from '../models/JobRequest';
import { Provider } from '../models/Provider';
import { DispatchSetting } from '../models/DispatchSetting';
import axios from 'axios';

let cronInterval: NodeJS.Timeout | null = null;

export const startReassignmentCron = () => {
  if (cronInterval) return;

  console.log('[REASSIGNMENT CRON] Automated 60-Second Reassignment Engine Initialized.');

  cronInterval = setInterval(async () => {
    try {
      const now = new Date();

      // Find expired pending job requests
      const expiredRequests = await JobRequest.find({
        status: 'pending',
        expires_at: { $lte: now }
      }).lean();

      if (expiredRequests.length === 0) return;

      for (const req of expiredRequests) {
        // Expire request
        await JobRequest.findByIdAndUpdate(req._id, { status: 'expired' });

        // Increment provider rejection/timeout metric
        await Provider.findByIdAndUpdate(req.provider_id, {
          $inc: { rejectionCount30d: 1 },
          $set: { consecutiveJobsToday: 0 }
        });

        // Trigger automatic re-dispatch for booking via booking-service internal lookup
        try {
          const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
          const bookingRes = await axios.get(`${BOOKING_URL}/api/bookings/internal/${req.booking_id}`, {
            headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
          });

          if (bookingRes.data && bookingRes.data.status === 'provider_searching') {
            const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
            await axios.post(`${providerServiceUrl}/api/providers/internal/dispatch`, {
              booking: bookingRes.data,
              address: bookingRes.data.address
            }, {
              headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
            });
          }
        } catch (dispatchErr) {
          // Non-blocking catch
        }
      }
    } catch (err: any) {
      console.error('[REASSIGNMENT CRON ERROR]', err.message);
    }
  }, 10000); // Check every 10 seconds
};

export const stopReassignmentCron = () => {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
};
