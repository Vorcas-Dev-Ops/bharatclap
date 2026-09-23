-- conn_a_book.sql
-- Connection A: acquire FOR UPDATE lock, hold it, then book
-- Uses advisory lock to synchronize with Connection B

-- Signal: "I'm starting"
SELECT pg_advisory_lock(999);

BEGIN;

-- Lock the slot row
SELECT booked_count, max_capacity
FROM booking.slot_capacities
WHERE provider_id = 'b0000000-0000-0000-0000-000000000001'
  AND slot_date = '2099-12-31' AND slot = '10:00'
FOR UPDATE;

-- Hold the row lock for 2 seconds so B has time to attempt
SELECT pg_sleep(2);

-- Book if available
UPDATE booking.slot_capacities
SET booked_count = booked_count + 1
WHERE provider_id = 'b0000000-0000-0000-0000-000000000001'
  AND slot_date = '2099-12-31' AND slot = '10:00'
  AND booked_count < max_capacity;

COMMIT;

-- Release advisory lock
SELECT pg_advisory_unlock(999);

SELECT 'CONN_A_DONE' AS status, booked_count
FROM booking.slot_capacities
WHERE provider_id = 'b0000000-0000-0000-0000-000000000001'
  AND slot_date = '2099-12-31' AND slot = '10:00';
