-- Migration 037: GPS staleness tracking + hold release support
-- Fixes: audit gaps #1 (GPS staleness) and #5 (wallet hold leak)

-- 1. Add GPS freshness timestamp to providers
ALTER TABLE provider.providers
    ADD COLUMN IF NOT EXISTS live_location_updated_at TIMESTAMPTZ;

-- Backfill: treat current updated_at as the initial GPS timestamp for any provider with a location
UPDATE provider.providers
   SET live_location_updated_at = updated_at
 WHERE live_location IS NOT NULL
   AND live_location_updated_at IS NULL;

-- Index for the reconciliation worker's stale-provider sweep
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_providers_location_staleness
    ON provider.providers (live_location_updated_at)
 WHERE is_online = TRUE AND live_location IS NOT NULL;

-- 2. Add dispatch_settings defaults for GPS stale minutes (if not already in JSON)
-- ponytail: settings is a JSONB column; we only set defaults if the key is missing
UPDATE provider.dispatch_settings
   SET settings = settings || '{"gpsStaleMinutes": 5}'::jsonb
 WHERE NOT (settings ? 'gpsStaleMinutes');
