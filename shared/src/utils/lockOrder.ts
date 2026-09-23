/**
 * Deadlock Prevention: Canonical Lock Ordering
 *
 * All services MUST acquire row-level locks in this order when a single
 * transaction touches multiple resource types. Violating this order
 * risks deadlock between concurrent transactions.
 *
 * Order (lowest → highest):
 *   1. booking.slot_capacities   (slot availability)
 *   2. booking.bookings          (booking record)
 *   3. payment.payments          (payment record)
 *   4. payment.customer_wallets  (customer wallet)
 *   5. provider.providers        (provider wallet/fencing)
 *   6. accounting.journal_entries + journal_lines (double-entry)
 *   7. booking.event_outbox / payment.payment_event_outbox (outbox)
 *
 * Example — booking + payment + accounting in one transaction:
 *   BEGIN;
 *   SELECT ... FROM booking.bookings WHERE id = $1 FOR UPDATE;       -- step 2
 *   SELECT ... FROM payment.payments WHERE booking_id = $1 FOR UPDATE; -- step 3
 *   INSERT INTO accounting.journal_entries ...;                       -- step 6
 *   INSERT INTO booking.event_outbox ...;                             -- step 7
 *   COMMIT;
 *
 * NEVER lock accounting before payment, or payment before booking.
 */

export const LOCK_ORDER = {
  SLOT_CAPACITY: 1,
  BOOKING: 2,
  PAYMENT: 3,
  CUSTOMER_WALLET: 4,
  PROVIDER_WALLET: 5,
  ACCOUNTING: 6,
  OUTBOX: 7,
} as const;

export type LockResource = keyof typeof LOCK_ORDER;

/**
 * Validates that lock resources are acquired in the correct order.
 * Call this in development/test to catch ordering violations early.
 *
 * Usage:
 *   const locks: LockResource[] = [];
 *   assertLockOrder(locks, 'BOOKING');    // OK
 *   assertLockOrder(locks, 'PAYMENT');    // OK (3 > 2)
 *   assertLockOrder(locks, 'SLOT_CAPACITY'); // THROWS (1 < 3)
 */
export const assertLockOrder = (acquired: LockResource[], next: LockResource): void => {
  if (acquired.length === 0) {
    acquired.push(next);
    return;
  }
  const lastOrder = LOCK_ORDER[acquired[acquired.length - 1]];
  const nextOrder = LOCK_ORDER[next];
  if (nextOrder <= lastOrder) {
    throw new Error(
      `DEADLOCK RISK: Attempting to lock ${next} (order=${nextOrder}) after ${acquired[acquired.length - 1]} (order=${lastOrder}). ` +
      `Lock order must be strictly ascending: ${Object.keys(LOCK_ORDER).join(' → ')}`
    );
  }
  acquired.push(next);
};
