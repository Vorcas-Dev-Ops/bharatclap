-- Migration 025: Dispatch Concurrency Hardening (Audit Rule #7)
-- Enforces:
-- 1. At most ONE accepted JobRequest per booking (ux_job_requests_single_accepted)
-- 2. At most ONE dispatch row per (booking_id, provider_id) (ux_job_requests_booking_provider)
-- 3. Pre-checks data integrity before index creation

DO $$
DECLARE
    dup_accepted_count INT;
    dup_dispatch_count INT;
BEGIN
    -- Check for duplicate accepted requests per booking
    SELECT COUNT(*) INTO dup_accepted_count
    FROM (
        SELECT booking_id
        FROM provider.job_requests
        WHERE status = 'accepted'
        GROUP BY booking_id
        HAVING COUNT(*) > 1
    ) sub;

    IF dup_accepted_count > 0 THEN
        RAISE EXCEPTION 'Migration 025 aborted: Found % bookings with multiple accepted job_requests.', dup_accepted_count;
    END IF;

    -- Check for duplicate (booking_id, provider_id) dispatches
    SELECT COUNT(*) INTO dup_dispatch_count
    FROM (
        SELECT booking_id, provider_id
        FROM provider.job_requests
        GROUP BY booking_id, provider_id
        HAVING COUNT(*) > 1
    ) sub;

    IF dup_dispatch_count > 0 THEN
        -- Safely clean up duplicate dispatches keeping the newest row
        DELETE FROM provider.job_requests jr1
        WHERE jr1.id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY booking_id, provider_id ORDER BY created_at DESC) as rnum
                FROM provider.job_requests
            ) ranked
            WHERE ranked.rnum > 1
        );
        RAISE NOTICE 'Cleaned up duplicate dispatch records.';
    END IF;
END $$;

-- Ensure columns are NOT NULL
ALTER TABLE provider.job_requests ALTER COLUMN booking_id SET NOT NULL;
ALTER TABLE provider.job_requests ALTER COLUMN provider_id SET NOT NULL;

-- 1. Single accepted provider index per booking
DROP INDEX IF EXISTS provider.ux_job_requests_single_accepted;
CREATE UNIQUE INDEX ux_job_requests_single_accepted
ON provider.job_requests (booking_id)
WHERE status = 'accepted';

-- 2. Single dispatch index per (booking, provider)
DROP INDEX IF EXISTS provider.ux_job_requests_booking_provider;
CREATE UNIQUE INDEX ux_job_requests_booking_provider
ON provider.job_requests (booking_id, provider_id);
