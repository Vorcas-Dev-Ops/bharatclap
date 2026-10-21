-- 034_payout_and_ledger_hardening.sql
-- Enforces two-person payout approval check and extends wallet_transactions ledger entry types.

-- 1. Extend wallet_transactions types to include commission and tds
ALTER TABLE provider.wallet_transactions 
  DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE provider.wallet_transactions 
  ADD CONSTRAINT wallet_transactions_type_check 
  CHECK (type IN (
    'recharge', 'refund', 'credit', 'initial_credit',
    'release', 'deduction', 'debit', 'hold',
    'penalty', 'adjustment', 'commission', 'tds'
  ));

-- 2. Add requested_by, approved_by, and two-person approval check on provider.payouts
ALTER TABLE provider.payouts
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Ensure payouts_status_check allows approved, completed, paid, and rejected
ALTER TABLE provider.payouts 
  DROP CONSTRAINT IF EXISTS payouts_status_check;

ALTER TABLE provider.payouts 
  ADD CONSTRAINT payouts_status_check 
  CHECK (status IN ('pending', 'processing', 'approved', 'completed', 'paid', 'failed', 'reversed', 'rejected'));

-- Drop older loose constraint if present
ALTER TABLE provider.payouts
  DROP CONSTRAINT IF EXISTS chk_payout_two_person_approval;

ALTER TABLE provider.payouts
  DROP CONSTRAINT IF EXISTS chk_payout_approval_needs_requester;

-- Status-based rule: When status is 'approved', 'processing', 'completed', or 'paid', it strictly requires:
-- 1. requested_by IS NOT NULL
-- 2. approved_by IS NOT NULL
-- 3. approved_by <> requested_by
ALTER TABLE provider.payouts
  ADD CONSTRAINT chk_payout_approval_needs_requester CHECK (
    status NOT IN ('approved', 'processing', 'completed', 'paid')
    OR (requested_by IS NOT NULL AND approved_by IS NOT NULL AND approved_by <> requested_by)
  );
