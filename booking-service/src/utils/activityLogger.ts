import { getDb } from '../config/db';

export const logBookingActivity = async (
  bookingId: any,
  action: string,
  actor: 'customer' | 'provider' | 'admin' | 'system',
  actorId?: string,
  details?: any
) => {
  try {
    const db = getDb();
    const detailsObj = details ? { ...details } : {};
    if (actorId) {
      detailsObj.actor_id = actorId;
    }
    await db.query(
      `INSERT INTO booking.booking_activities (booking_id, action, actor, details)
       VALUES (
         (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1 LIMIT 1),
         $2, $3, $4
       )`,
      [String(bookingId), action, actor, JSON.stringify(detailsObj)]
    );
  } catch (err: any) {
    console.error('[ACTIVITY LOGGER ERROR]', err.message);
  }
};
