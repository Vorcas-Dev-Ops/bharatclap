import { Booking } from '../models/Booking';
import axios from 'axios';
import { getAddressesBatch } from '../utils/internalApi';

const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const DEFAULT_INTERNAL_KEY = '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

const internalHeaders = () => {
  const key = process.env.INTERNAL_SERVICE_KEY || DEFAULT_INTERNAL_KEY;
  return { 'x-internal-service-key': key };
};

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
};

// ─── Core dispatch logic (no Redis dependency) ────────────────────────────────

const processDispatchBatch = async (bookingIds: string[]) => {
  if (!bookingIds || bookingIds.length === 0) return;

  const bookings = await Booking.find({ _id: { $in: bookingIds } });
  if (bookings.length === 0) return;

  const graceMinutes = Number(process.env.BOOKING_START_GRACE_MINUTES) || 60;
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);

  const validBookings = bookings.filter(b => {
    if (b.scheduled_at && new Date(b.scheduled_at) < cutoff) {
      console.log(`[DISPATCH BATCH] ⛔ Booking ${b._id} is past grace period (scheduled: ${b.scheduled_at}). Skipping dispatch.`);
      return false;
    }
    return true;
  });

  if (validBookings.length === 0) return;

  await Booking.updateMany({ _id: { $in: validBookings.map(b => b._id) } }, { status: 'provider_searching' });

  const addresses = await getAddressesBatch([validBookings[0].address_id.toString()]);
  const address = addresses.length > 0 ? addresses[0] : null;

  if (!address) {
    console.log(`[DISPATCH BATCH] ❌ No address found for bookings`);
    return;
  }

  const response = await axios.post(`${PROVIDER_SERVICE_URL}/api/providers/internal/dispatch-batch`, {
    bookings: bookings.map(b => b.toObject ? b.toObject() : b),
    address
  }, {
    headers: internalHeaders()
  });

  if (response.data && response.data.results) {
    const mongoose = await import('mongoose');
    const bulkOps = response.data.results
      .filter((res: any) => res.provider_id)
      .map((res: any) => ({
        updateOne: {
          filter: { _id: new mongoose.default.Types.ObjectId(String(res.booking_id)) },
          update: { $set: { provider_id: new mongoose.default.Types.ObjectId(String(res.provider_id)) } }
        }
      }));

    if (bulkOps.length > 0) {
      await Booking.bulkWrite(bulkOps);
    }

    for (const res of response.data.results) {
      if (res.provider_id) {
        console.log(`[DISPATCH BATCH] ✅ Provider ${res.provider_id} assigned to booking ${res.booking_id}`);
      } else {
        console.log(`[DISPATCH BATCH] ❌ No provider found for booking ${res.booking_id}`);
      }
    }
  }
};

// ─── BullMQ setup with graceful fallback ──────────────────────────────────────

let queueReady = false;
let dispatchQueue: any = null;
let dispatchWorker: any = null;

const initBullMQ = async () => {
  try {
    const { Queue, Worker } = await import('bullmq');
    const { default: IORedis } = await import('ioredis');

    // Test the connection before wiring up the queue
    const testClient = new IORedis({ ...redisOptions, lazyConnect: true });
    await testClient.connect();
    const info = await testClient.info('server');
    await testClient.quit();

    // Parse redis_version from INFO output
    const match = info.match(/redis_version:(\S+)/);
    if (match) {
      const [major] = match[1].split('.').map(Number);
      if (major < 5) {
        console.warn(`[DISPATCH] ⚠️  Redis ${match[1]} detected — BullMQ requires Redis ≥ 5. Falling back to direct async dispatch.`);
        return;
      }
    }

    dispatchQueue = new Queue('booking-dispatch-queue', { connection: redisOptions });

    dispatchWorker = new Worker(
      'booking-dispatch-queue',
      async (job: any) => {
        if (job.name === 'dispatchBatch') {
          await processDispatchBatch(job.data.bookingIds);
        }
      },
      { connection: redisOptions }
    );

    dispatchWorker.on('failed', (job: any, err: Error) => {
      console.error(`[DISPATCH WORKER] Job ${job?.id} failed:`, err.message);
    });

    queueReady = true;
    console.log('[DISPATCH] ✅ BullMQ queue initialised successfully.');
  } catch (err: any) {
    console.warn(`[DISPATCH] ⚠️  Could not connect to Redis (${err.message}). Falling back to direct async dispatch.`);
  }
};

// Initialise in background — does NOT block server startup
initBullMQ().catch(() => {});

export const closeQueue = async (): Promise<void> => {
  if (dispatchQueue) {
    await dispatchQueue.close();
    console.log('[DISPATCH] Queue closed.');
  }
  if (dispatchWorker) {
    await dispatchWorker.close();
    console.log('[DISPATCH] Worker closed.');
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const dispatchNearbyProviders = async (bookingId: string): Promise<void> => {
  if (queueReady && dispatchQueue) {
    await dispatchQueue.add(
      'dispatchBatch',
      { bookingIds: [bookingId] },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );
  } else {
    // Direct fallback: fire-and-forget in background
    processDispatchBatch([bookingId]).catch(err =>
      console.error(`[DISPATCH DIRECT] Error dispatching booking ${bookingId}:`, err.message)
    );
  }
};

export const dispatchBooking = dispatchNearbyProviders;

export const dispatchMultipleBookings = async (bookingIds: string[]): Promise<void> => {
  if (!bookingIds || bookingIds.length === 0) return;

  if (queueReady && dispatchQueue) {
    await dispatchQueue.add(
      'dispatchBatch',
      { bookingIds },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );
  } else {
    processDispatchBatch(bookingIds).catch(err =>
      console.error(`[DISPATCH DIRECT] Error dispatching batch:`, err.message)
    );
  }
};
