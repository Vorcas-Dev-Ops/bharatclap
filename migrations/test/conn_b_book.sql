-- conn_b_book.sql
-- Connection B: waits 0.5s then attempts same slot
-- Should BLOCK on FOR UPDATE until A commits, then see updated booked_count

-- Wait a moment for A to acquire the row lock first
SELECT pg_sleep(0.5);

BEGIN;

-- This will BLOCK until A releases the row lock
SELECT booked_count, max_capacity
FROM booking.slot_capacities
WHERE provider_id = 'b0000000-0000-0000-0000-000000000001'
  AND slot_date = '2099-12-31' AND slot = '10:00'
FOR UPDATE;

-- By now A has committed, booked_count should be 1
-- This UPDATE should return 0 rows (booked_count=1, max_capacity=1)
UPDATE booking.slot_capacities
SET booked_count = booked_count + 1
WHERE provider_id = 'b0000000-0000-0000-0000-000000000001'
  AND slot_date = '2099-12-31' AND slot = '10:00'
  AND booked_count < max_capacity;

COMMIT;

SELECT 'CONN_B_DONE' AS status, booked_count
FROM booking.slot_capacities
WHERE provider_id = 'b0000000-0000-0000-0000-000000000001'
  AND slot_date = '2099-12-31' AND slot = '10:00';
