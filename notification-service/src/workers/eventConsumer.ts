/**
 * Event consumer for notification-service.
 * Subscribes to Redis Streams events emitted by booking-service and payment-service,
 * and dispatches notifications via BullMQ with native jobId deduplication.
 */
import { eventBus, EventEnvelope } from '@bharatclap/shared';
import { notificationQueue } from '../config/queue';
import { ProcessedEvent } from '../models/ProcessedEvent';

const CONSUMER_GROUP = 'bharatclap:notification:consumers';
const CONSUMER_NAME = `notification-${process.pid}`;

/**
 * Helper to enforce idempotency at consumer boundary.
 * Returns true if event is new and recorded successfully; false if duplicate.
 */
async function recordEventProcessed(eventId: string): Promise<boolean> {
  if (!eventId) return true;
  try {
    await ProcessedEvent.create({ event_id: eventId, processed_at: new Date() });
    return true;
  } catch (err: any) {
    if (err.code === 11000) {
      console.log(`[EVENT-CONSUMER IDEMPOTENCY] Event ${eventId} already processed. Skipping.`);
      return false;
    }
    throw err;
  }
}

/**
 * Handle BookingCreated events — send confirmation notification to user.
 */
async function handleBookingCreated(payload: any, envelope: EventEnvelope): Promise<void> {
  const eventId = envelope.traceId || `booking.created:${payload.bookingId}`;
  const { bookingId, bookingDisplayId, userId } = payload;

  if (!userId || !bookingDisplayId) {
    console.warn('[EVENT-CONSUMER] BookingCreated missing required fields:', payload);
    return;
  }

  const isNew = await recordEventProcessed(eventId);
  if (!isNew) return; // Duplicate event, skip

  await notificationQueue.add(
    'send-notification',
    {
      recipient_id: userId,
      recipient_type: 'User',
      title: 'Booking Confirmed',
      message: `Your booking ${bookingDisplayId} has been confirmed.`,
      type: 'booking_alert',
      metadata: { booking_id: bookingId },
    },
    { jobId: eventId }
  );

  console.log(`[EVENT-CONSUMER] BookingCreated → queued notification (jobId: ${eventId}) for user ${userId}, booking ${bookingDisplayId}`);
}

/**
 * Handle ProviderAssigned events — notify user and provider.
 */
async function handleProviderAssigned(payload: any, envelope: EventEnvelope): Promise<void> {
  const { bookingId, bookingDisplayId, userId, providerId } = payload;
  const eventId = envelope.traceId || `provider.assigned:${bookingId}:${providerId}`;

  if (!userId || !bookingDisplayId) {
    console.warn('[EVENT-CONSUMER] ProviderAssigned missing required fields:', payload);
    return;
  }

  const isNew = await recordEventProcessed(eventId);
  if (!isNew) return;

  await notificationQueue.add(
    'send-notification',
    {
      recipient_id: userId,
      recipient_type: 'User',
      title: 'Provider Assigned',
      message: `A provider has been assigned to your booking ${bookingDisplayId}.`,
      type: 'booking_alert',
      metadata: { booking_id: bookingId },
    },
    { jobId: eventId }
  );

  console.log(`[EVENT-CONSUMER] ProviderAssigned → queued notification (jobId: ${eventId}) for user ${userId}`);
}

/**
 * Handle BookingCompleted events — notify user and provider.
 */
async function handleBookingCompleted(payload: any, envelope: EventEnvelope): Promise<void> {
  const { bookingId, bookingDisplayId, userId, providerId } = payload;
  const eventId = envelope.traceId || `booking.completed:${bookingId}`;

  if (!userId || !bookingDisplayId) {
    console.warn('[EVENT-CONSUMER] BookingCompleted missing required fields:', payload);
    return;
  }

  const isNew = await recordEventProcessed(eventId);
  if (!isNew) return;

  const msg = `Your booking ${bookingDisplayId} has been marked as completed successfully. Thank you for choosing BharatClap!`;
  await notificationQueue.add(
    'send-notification',
    {
      recipient_id: userId,
      recipient_type: 'User',
      title: 'Booking Completed!',
      message: msg,
      type: 'booking_alert',
      metadata: { booking_id: bookingId },
    },
    { jobId: eventId }
  );

  console.log(`[EVENT-CONSUMER] BookingCompleted → queued notification (jobId: ${eventId}) for user ${userId}`);
}

/**
 * Handle PaymentCompleted events — send payment success notification to user.
 */
async function handlePaymentCompleted(payload: any, envelope: EventEnvelope): Promise<void> {
  const eventId = envelope.traceId || `payment.completed:${payload.paymentId}`;
  const { paymentId, bookingId, userId, amount } = payload;

  if (!userId || !amount) {
    console.warn('[EVENT-CONSUMER] PaymentCompleted missing required fields:', payload);
    return;
  }

  const isNew = await recordEventProcessed(eventId);
  if (!isNew) return;

  await notificationQueue.add(
    'send-notification',
    {
      recipient_id: userId,
      recipient_type: 'User',
      title: 'Payment Successful',
      message: `Your payment of ₹${amount} has been successfully processed.`,
      type: 'payment_alert',
      metadata: { payment_id: paymentId, booking_id: bookingId },
    },
    { jobId: eventId }
  );

  console.log(`[EVENT-CONSUMER] PaymentCompleted → queued notification (jobId: ${eventId}) for user ${userId}, payment ${paymentId}`);
}

/**
 * Start consuming events from Redis Streams.
 * Call this after Redis is connected.
 */
export async function startEventConsumer(redisClient: any): Promise<void> {
  try {
    eventBus.init(redisClient);

    const subOpts = { group: CONSUMER_GROUP, consumer: CONSUMER_NAME, maxRetries: 5, blockMs: 2000, batchSize: 10 };

    await eventBus.subscribe('BookingCreated', handleBookingCreated, subOpts);
    await eventBus.subscribe('ProviderAssigned', handleProviderAssigned, subOpts);
    await eventBus.subscribe('BookingCompleted', handleBookingCompleted, subOpts);
    await eventBus.subscribe('PaymentCompleted', handlePaymentCompleted, subOpts);

    console.log('[EVENT-CONSUMER] ✅ Subscribed to all business event streams (BookingCreated, ProviderAssigned, BookingCompleted, PaymentCompleted)');
  } catch (err: any) {
    console.error('[EVENT-CONSUMER] Failed to start:', err.message);
  }
}
