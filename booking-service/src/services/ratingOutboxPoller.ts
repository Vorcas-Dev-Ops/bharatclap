import { RatingOutbox } from '../models/RatingOutbox';
import axios from 'axios';

let isProcessing = false;

export const processRatingOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pendingEntries = await RatingOutbox.find({
      status: { $in: ['PENDING', 'FAILED'] },
      attempts: { $lt: 10 },
    }).sort({ createdAt: 1 }).limit(20);

    if (pendingEntries.length === 0) {
      isProcessing = false;
      return;
    }

    const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
    const internalKey = process.env.INTERNAL_SERVICE_KEY || '';

    for (const entry of pendingEntries) {
      entry.attempts += 1;
      entry.last_attempted_at = new Date();

      try {
        const response = await axios.post(
          `${providerServiceUrl}/api/internal/provider/submit-rating`,
          {
            providerId: String(entry.provider_id),
            rating: entry.rating,
            reviewId: String(entry.review_id),
          },
          {
            headers: { 'x-internal-service-key': internalKey },
            timeout: 5000,
          }
        );

        if (response.data?.success) {
          entry.status = 'CONFIRMED';
          console.log(`[RATING OUTBOX] ✅ Rating delivered for review ${entry.review_id}`);
        } else {
          entry.status = 'FAILED';
          entry.error_message = response.data?.message || 'Unknown rejection';
        }
      } catch (err: any) {
        entry.status = 'FAILED';
        entry.error_message = err.response?.data?.message || err.message;
        console.error(`[RATING OUTBOX] ⚠️ Retry ${entry.attempts} failed for review ${entry.review_id}:`, entry.error_message);
      }

      await entry.save();
    }
  } catch (err: any) {
    console.error('[RATING OUTBOX POLLER ERROR]', err.message);
  } finally {
    isProcessing = false;
  }
};

export const startRatingOutboxPoller = () => {
  // ponytail: same cadence as lead refund outbox — 10s initial delay, 30s interval
  setTimeout(processRatingOutbox, 10000);
  const interval = setInterval(processRatingOutbox, 30000);
  return interval;
};
