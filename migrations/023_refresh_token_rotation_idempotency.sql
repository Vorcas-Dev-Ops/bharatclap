-- 023_refresh_token_rotation_idempotency.sql
-- Enables idempotent refresh token rotation with a concurrent grace window

ALTER TABLE auth.refresh_tokens
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replaced_by_hash TEXT,
  ADD COLUMN IF NOT EXISTS replacement_access_token TEXT;

CREATE INDEX IF NOT EXISTS ix_token_rotated_at ON auth.refresh_tokens(rotated_at)
  WHERE revoked = TRUE;
