-- Migration 022: Webhook Idempotency & Order Maintenance
CREATE TABLE IF NOT EXISTS provider.processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100),
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_id
  ON provider.processed_webhook_events (event_id);

-- Index for periodic maintenance cleanup of stale pending orders
CREATE INDEX IF NOT EXISTS idx_provider_orders_pending_cleanup
  ON provider.provider_orders (created_at)
  WHERE status = 'pending';
