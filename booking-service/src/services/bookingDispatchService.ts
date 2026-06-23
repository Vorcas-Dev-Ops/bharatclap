import { Booking } from '../models/Booking';
import axios from 'axios';
import { getAddressesBatch } from '../utils/internalApi';
import { Queue, Worker, Job } from 'bullmq';

const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003';

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
};

// Create the BullMQ queue
export const dispatchQueue = new Queue('booking-dispatch-queue', { connection: redisOptions });

// Background processor function (previously the sync dispatchMultipleBookings logic)
const processDispatchBatch = async (bookingIds: string[]) => {
  if (!bookingIds || bookingIds.length === 0) return;

  const bookings = await Booking.find({ _id: { $in: bookingIds } });
  if (bookings.length === 0) return;

  await Booking.updateMany({ _id: { $in: bookingIds } }, { status: 'provider_searching' });

  // Assuming all bookings from the same checkout share the same address
  const addresses = await getAddressesBatch([bookings[0].address_id.toString()]);
  const address = addresses.length > 0 ? addresses[0] : null;

  if (!address) {
    console.log(`[DISPATCH BATCH WORKER] ❌ No address found for bookings`);
    return;
  }

  const response = await axios.post(`${PROVIDER_SERVICE_URL}/api/providers/internal/dispatch-batch`, {
    bookings: bookings.map(b => b.toObject ? b.toObject() : b),
    address
  });

  if (response.data && response.data.results) {
    for (const res of response.data.results) {
      if (res.provider_id) {
        await Booking.findByIdAndUpdate(res.booking_id, { provider_id: res.provider_id });
        console.log(`[DISPATCH BATCH WORKER] Provider ${res.provider_id} auto-assigned to booking ${res.booking_id}`);
      } else {
        console.log(`[DISPATCH BATCH WORKER] ❌ No provider found for booking ${res.booking_id}`);
      }
    }
  }
};

// Create the Worker to process items off the queue
const worker = new Worker(
  'booking-dispatch-queue',
  async (job: Job) => {
    if (job.name === 'dispatchBatch') {
      await processDispatchBatch(job.data.bookingIds);
    }
  },
  { connection: redisOptions }
);

worker.on('failed', (job, err) => {
  console.error(`[DISPATCH WORKER] Job ${job?.id} failed with error:`, err.message);
});

export const dispatchNearbyProviders = async (bookingId: string) => {
  // Keep signature for individual fallback if needed, but route to queue
  await dispatchQueue.add(
    'dispatchBatch',
    { bookingIds: [bookingId] },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );
};

export const dispatchBooking = dispatchNearbyProviders;

export const dispatchMultipleBookings = async (bookingIds: string[]) => {
  if (!bookingIds || bookingIds.length === 0) return;
  await dispatchQueue.add(
    'dispatchBatch',
    { bookingIds },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );
};
