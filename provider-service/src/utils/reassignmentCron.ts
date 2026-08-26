import { JobRequest } from '../models/JobRequest';
import { Provider } from '../models/Provider';
import { DispatchSetting } from '../models/DispatchSetting';
import { WalletTransaction } from '../models/WalletTransaction';
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
        // ponytail: atomic expiry — prevents double processing by multiple workers
        const expireResult = await JobRequest.findOneAndUpdate(
          { _id: req._id, status: 'pending', expires_at: { $lte: now } },
          { $set: { status: 'expired', expired_at: now, expired_reason: 'acceptance_timeout' } }
        );
        if (!expireResult) continue; // Already expired by another worker

        // Release wallet hold if any
        try {
          const holdTx = await WalletTransaction.findOne({
            provider_id: req.provider_id,
            type: 'hold',
            referenceId: String(req.booking_id)
          });
          if (holdTx) {
            const releaseTx = await WalletTransaction.findOne({
              type: 'release',
              referenceId: String(req.booking_id)
            });
            if (!releaseTx) {
              const provDoc = await Provider.findById(req.provider_id);
              if (provDoc) {
                provDoc.reservedBalance = Math.max(0, provDoc.reservedBalance - holdTx.amount);
                await provDoc.save();

                await WalletTransaction.create({
                  provider_id: provDoc._id,
                  type: 'release',
                  amount: holdTx.amount,
                  balanceAfter: provDoc.walletBalance - provDoc.reservedBalance,
                  referenceId: String(req.booking_id),
                  description: `Release hold for booking dispatch timeout #${req.booking_id}`,
                  status: 'success'
                });
              }
            }
          }
        } catch (holdErr: any) {
          console.warn('[REASSIGNMENT CRON] Hold release warning:', holdErr.message);
        }

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
            // ponytail: don't redispatch if overall booking expiry reached
            if (bookingRes.data.provider_search_expires_at &&
                new Date(bookingRes.data.provider_search_expires_at) <= new Date()) {
              continue;
            }
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
