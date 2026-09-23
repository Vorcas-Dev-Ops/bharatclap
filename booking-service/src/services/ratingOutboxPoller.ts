import axios from 'axios';
import { OutboxRepository } from '../repositories/outboxRepository';
import { getDb } from '../config/db';

let isProcessing = false;

export const processRatingOutbox = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pending = await OutboxRepository.fetchPendingRatings(20);
    if (pending.length === 0) {
      isProcessing = false;
      return;
    }

    const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
    const internalKey = process.env.INTERNAL_SERVICE_KEY || '';
    const db = getDb();

    for (const entry of pending) {
      try {
        const response = await axios.post(
          `${providerServiceUrl}/api/internal/provider/submit-rating`,
          {
            providerId: String(entry.provider_id),
            rating: entry.rating,
            reviewId: String(entry.id),
          },
          {
            headers: { 'x-internal-service-key': internalKey },
            timeout: 5000,
          }
        );

        if (response.data?.success) {
          await OutboxRepository.markRatingPublished(entry.id);
          console.log(`[RATING OUTBOX] ✅ Rating delivered for ${entry.id}`);
        } else {
          await db.query(`UPDATE booking.rating_outbox SET status = 'FAILED', updated_at = NOW() WHERE id = $1`, [entry.id]);
        }
      } catch (err: any) {
        await db.query(`UPDATE booking.rating_outbox SET status = 'FAILED', updated_at = NOW() WHERE id = $1`, [entry.id]);
        console.error(`[RATING OUTBOX] ⚠️ Retry failed for review ${entry.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[RATING OUTBOX POLLER ERROR]', err.message);
  } finally {
    isProcessing = false;
  }
};

export const startRatingOutboxPoller = () => {
  setTimeout(processRatingOutbox, 10000);
  const interval = setInterval(processRatingOutbox, 30000);
  return interval;
};
