-- 027_financial_integrity_phase5_6.sql
-- Audit Rule #8, Phase 5+6: Refund-settlement reconciliation statuses + COD state machine

-- 1. Add refund_pending/refunded to settlement status CHECK
--    Must DROP and re-ADD because PostgreSQL doesn't support ALTER CHECK
ALTER TABLE provider.provider_settlements
  DROP CONSTRAINT IF EXISTS provider_settlements_status_check;

ALTER TABLE provider.provider_settlements
  ADD CONSTRAINT provider_settlements_status_check CHECK (status IN (
    'pending_hold', 'ready_for_payout', 'processing',
    'paid', 'failed', 'disputed', 'held_by_admin',
    'cod_pending', 'cod_settled', 'cancelled',
    'refund_pending', 'refunded'
  ));

-- 2. Index for refund reconciliation queries
CREATE INDEX IF NOT EXISTS ix_settlement_refund ON provider.provider_settlements(status)
  WHERE status IN ('refund_pending', 'refunded');
