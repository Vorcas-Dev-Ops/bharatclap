-- ==============================================================================
-- Migration 019: Add expires_at column to provider.job_requests
-- Resolves [REASSIGNMENT CRON ERROR] and [RECONCILIATION ERROR]
-- ==============================================================================

ALTER TABLE provider.job_requests
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill any existing job requests with an estimated expiry (offered_at + 60s)
UPDATE provider.job_requests
SET expires_at = COALESCE(expires_at, offered_at + INTERVAL '60 seconds', NOW() + INTERVAL '60 seconds')
WHERE expires_at IS NULL;

-- Default new rows to NOW() + 60s if not explicitly passed
ALTER TABLE provider.job_requests
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '60 seconds');

-- Optimize cron queries: WHERE status = 'pending' AND expires_at <= $1
CREATE INDEX IF NOT EXISTS ix_job_requests_pending_expires 
  ON provider.job_requests(expires_at) 
  WHERE status = 'pending';
