import { BookingActivity } from '../models/BookingActivity';

export const logBookingActivity = async (
  bookingId: any,
  action: string,
  actor: 'customer' | 'provider' | 'admin' | 'system',
  actorId?: string,
  details?: any
) => {
  try {
    await BookingActivity.create({
      booking_id: bookingId,
      action,
      actor,
      actor_id: actorId,
      details
    });
  } catch (err: any) {
    console.error('[ACTIVITY LOGGER ERROR]', err.message);
  }
};
