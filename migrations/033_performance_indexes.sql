-- ============================================================================
-- Migration 033: High-Priority PostgreSQL Performance Indexes & Deduplication
-- ============================================================================
-- Purpose:
--   1. Provide partial indexes for all 5 outbox polling tables to eliminate
--      periodic full-table sequential scans under background workers.
--   2. Index high-traffic unindexed foreign keys to accelerate joins and eliminate
--      cascading table locks during updates and deletions.
--   3. Accelerate core booking-management, order lookups, and dispatch queries.
--   4. Remove redundant duplicate index on provider.providers(kit_collection_id).
--
-- Deployment note:
--   When running through the standard migration runner, indexes are created using
--   standard `CREATE INDEX IF NOT EXISTS`.
--   For zero-lock live production migrations on large active tables, indexes can be
--   applied concurrently outside transaction blocks (see companion deployment guide).
-- ============================================================================

BEGIN;

-- ── 1. Outbox Poller Partial Indexes ─────────────────────────────────────────

-- Settlement outbox poller (booking-service)
CREATE INDEX IF NOT EXISTS ix_settlement_outbox_pending
  ON booking.settlement_outbox (created_at ASC)
  WHERE status = 'PENDING';

-- Lead refund outbox poller (booking-service)
CREATE INDEX IF NOT EXISTS ix_lead_refund_outbox_pending
  ON booking.lead_refund_outbox (created_at ASC)
  WHERE status = 'PENDING';

-- Rating outbox poller (booking-service)
CREATE INDEX IF NOT EXISTS ix_rating_outbox_pending
  ON booking.rating_outbox (created_at ASC)
  WHERE status = 'PENDING';

-- Compensation outbox poller (provider-service)
CREATE INDEX IF NOT EXISTS ix_compensation_outbox_pending
  ON provider.compensation_outbox (created_at ASC)
  WHERE status IN ('PENDING', 'PROCESSING');

-- Wallet outbox poller (provider-service)
CREATE INDEX IF NOT EXISTS ix_wallet_outbox_pending
  ON provider.wallet_outbox (created_at ASC)
  WHERE status = 'PENDING';

-- Payment event outbox poller (payment-service)
CREATE INDEX IF NOT EXISTS ix_payment_event_outbox_pending
  ON payment.payment_event_outbox (created_at ASC)
  WHERE status = 'PENDING';


-- ── 2. High-Traffic Foreign Key Indexes ──────────────────────────────────────

-- Booking relationships
CREATE INDEX IF NOT EXISTS ix_complaints_booking_id
  ON booking.complaints (booking_id);

CREATE INDEX IF NOT EXISTS ix_booking_previous_providers_booking_id
  ON booking.booking_previous_providers (booking_id);

CREATE INDEX IF NOT EXISTS ix_conversations_booking_id
  ON booking.conversations (booking_id);

CREATE INDEX IF NOT EXISTS ix_coupon_redemptions_booking_id
  ON booking.coupon_redemptions (booking_id);

-- Provider relationships
CREATE INDEX IF NOT EXISTS ix_provider_locations_provider_id
  ON provider.provider_locations (provider_id);

CREATE INDEX IF NOT EXISTS ix_payouts_provider_id
  ON provider.payouts (provider_id);

CREATE INDEX IF NOT EXISTS ix_payouts_settlement_id
  ON provider.payouts (settlement_id);

CREATE INDEX IF NOT EXISTS ix_job_requests_provider_id
  ON provider.job_requests (provider_id);

-- Payment relationships
CREATE INDEX IF NOT EXISTS ix_customer_wallet_tx_wallet_id
  ON payment.customer_wallet_transactions (wallet_id);

CREATE INDEX IF NOT EXISTS ix_payment_attempts_payment_id
  ON payment.payment_attempts (payment_id);


-- ── 3. Booking Management & Dispatch Optimization ───────────────────────────

-- Order lookup index in bookings (webhook idempotency and payment reconcile)
CREATE INDEX IF NOT EXISTS ix_bookings_order_id
  ON booking.bookings (order_id)
  WHERE order_id IS NOT NULL;

-- Stuck booking filter for accepted state over threshold
CREATE INDEX IF NOT EXISTS ix_bookings_stuck_accepted
  ON booking.bookings (accepted_at ASC)
  WHERE deleted_at IS NULL AND status = 'accepted';

-- Provider candidate coordinates for spatial radius queries
CREATE INDEX IF NOT EXISTS ix_prov_loc_lat_lng
  ON provider.provider_locations (latitude, longitude)
  WHERE status = 'active';

-- Provider subservice dispatch matching
CREATE INDEX IF NOT EXISTS ix_prov_services_provider_active
  ON provider.provider_services (provider_id, is_active);

CREATE INDEX IF NOT EXISTS ix_prov_subservices_subservice
  ON provider.provider_service_subservices (subservice_id, provider_service_id);


-- ── 4. Redundant Index Deduplication ─────────────────────────────────────────

-- Verified identical duplicate: uq_providers_kit_collection_id is retained
DROP INDEX IF EXISTS provider.idx_providers_kit_collection_id;

COMMIT;
