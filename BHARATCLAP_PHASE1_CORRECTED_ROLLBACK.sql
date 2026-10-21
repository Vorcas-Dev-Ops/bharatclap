-- ============================================================================
-- BharatClap — Phase 1 Performance Rollback Reference (MANUAL TEMPLATE)
-- Deliverable: BHARATCLAP_PHASE1_CORRECTED_ROLLBACK.sql
-- ============================================================================
-- ⚠️  THIS FILE IS A REFERENCE TEMPLATE, NOT THE PRODUCTION ROLLBACK PROCEDURE.
--
-- PRODUCTION ROLLBACK: Use the automated runner:
--   DATABASE_URL="<connection>" npx tsx migrations/production_rollback_033.ts
--
-- The automated runner:
--   1. Reads production_migration_033_state.json to identify ownership.
--   2. Drops ONLY indexes marked CREATED_BY_DEPLOYMENT.
--   3. Preserves all PRE_EXISTING_PRESERVED indexes.
--   4. Verifies each drop in the catalog before proceeding.
--   5. Deletes the migration record ONLY after all rollback operations verified.
--
-- This SQL file exists solely for DBA reference and disaster recovery when the
-- automated runner is unavailable. Before using it manually:
--   1. Capture the current index inventory into PRE_EXISTING_INDEXES.txt.
--   2. Remove any DROP statement for an index that existed before deployment.
--   3. Execute in a maintenance window (transactional mode) OR convert to
--      DROP INDEX CONCURRENTLY statements outside transaction blocks.
-- ============================================================================

-- === MAINTENANCE WINDOW MODE (transactional) ================================
-- Only use this path during an exclusive maintenance window with no live traffic.
-- Remove any line whose index existed before the 033 deployment.

BEGIN;

-- ── 1. Drop Outbox Poller Partial Indexes ─────────────────────────────────────
DROP INDEX IF EXISTS booking.ix_settlement_outbox_pending;
DROP INDEX IF EXISTS booking.ix_lead_refund_outbox_pending;
DROP INDEX IF EXISTS booking.ix_rating_outbox_pending;
DROP INDEX IF EXISTS provider.ix_compensation_outbox_pending;
DROP INDEX IF EXISTS provider.ix_wallet_outbox_pending;
DROP INDEX IF EXISTS payment.ix_payment_event_outbox_pending;

-- ── 2. Drop Foreign Key Indexes ──────────────────────────────────────────────
DROP INDEX IF EXISTS booking.ix_complaints_booking_id;
DROP INDEX IF EXISTS booking.ix_booking_previous_providers_booking_id;
DROP INDEX IF EXISTS booking.ix_conversations_booking_id;
DROP INDEX IF EXISTS booking.ix_coupon_redemptions_booking_id;
DROP INDEX IF EXISTS provider.ix_provider_locations_provider_id;
DROP INDEX IF EXISTS provider.ix_payouts_provider_id;
DROP INDEX IF EXISTS provider.ix_payouts_settlement_id;
DROP INDEX IF EXISTS provider.ix_job_requests_provider_id;
DROP INDEX IF EXISTS payment.ix_customer_wallet_tx_wallet_id;
DROP INDEX IF EXISTS payment.ix_payment_attempts_payment_id;

-- ── 3. Drop Booking & Dispatch Optimization Indexes ──────────────────────────
DROP INDEX IF EXISTS booking.ix_bookings_order_id;
DROP INDEX IF EXISTS booking.ix_bookings_stuck_accepted;
DROP INDEX IF EXISTS provider.ix_prov_loc_lat_lng;
DROP INDEX IF EXISTS provider.ix_prov_services_provider_active;
DROP INDEX IF EXISTS provider.ix_prov_subservices_subservice;

-- ── 4. Restore Pre-existing Deduplicated Index ───────────────────────────────
-- Restores idx_providers_kit_collection_id exactly as defined in migration 018.
-- uq_providers_kit_collection_id (migration 020) remained active throughout.
CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_kit_collection_id
  ON provider.providers (kit_collection_id)
  WHERE (kit_collection_id IS NOT NULL);

-- ── 5. Revert Migration Runner Tracking ──────────────────────────────────────
-- ⚠️  Only delete AFTER verifying all drops succeeded.
-- Run: SELECT count(*) FROM pg_class WHERE relname IN ('ix_settlement_outbox_pending', ...);
-- If count > 0, do NOT execute this DELETE.
DELETE FROM migration.schema_migrations
WHERE filename = '033_performance_indexes.sql';

COMMIT;
