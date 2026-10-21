-- 026_financial_integrity_phase1.sql
-- Audit Rule #8, Phase 1: Schema integrity for wallet audit logs
-- Adds columns that walletRepository.recordTransaction() expects but wallet_audit_logs lacks.
-- Also adds database-level non-negative balance constraint on provider.wallets.

-- 1. Fix wallet_audit_logs schema mismatch (Defect A)
--    Code inserts: actor_type, actor_id, balance_before, balance_after, metadata
--    Schema only has: old_value, new_value, performed_by
ALTER TABLE provider.wallet_audit_logs
  ADD COLUMN IF NOT EXISTS actor_type     TEXT,
  ADD COLUMN IF NOT EXISTS actor_id       UUID,
  ADD COLUMN IF NOT EXISTS balance_before NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS balance_after  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS metadata       JSONB DEFAULT '{}';

-- 2. Non-negative wallet balance constraint (Defect I / Phase 2 prep)
--    Fail-safe: if any existing wallet has negative balance, this will error.
--    That is intentional — we must know about it before proceeding.
ALTER TABLE provider.wallets
  ADD CONSTRAINT ck_wallet_non_negative CHECK (balance >= 0);
