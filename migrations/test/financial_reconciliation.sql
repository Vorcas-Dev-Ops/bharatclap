-- financial_reconciliation.sql
-- BharatClap — Post-migration financial reconciliation queries
-- Run against BOTH Mongo (via aggregation) and PG to compare.
-- All aggregate totals must match before cutover.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Payments — count + gross + refund + net
-- ═══════════════════════════════════════════════════════════════════
SELECT
  'PAYMENTS' AS entity,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE payment_status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE payment_status = 'Refunded') AS refunded_count,
  COUNT(*) FILTER (WHERE payment_status = 'Pending') AS pending_count,
  COALESCE(SUM(amount), 0) AS gross_amount,
  COALESCE(SUM(amount) FILTER (WHERE payment_status = 'Refunded'), 0) AS refund_amount,
  COALESCE(SUM(amount) FILTER (WHERE payment_status = 'completed'), 0) AS net_completed
FROM payment.payments;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Payments by status distribution
-- ═══════════════════════════════════════════════════════════════════
SELECT
  payment_status,
  COUNT(*) AS count,
  COALESCE(SUM(amount), 0) AS total_amount
FROM payment.payments
GROUP BY payment_status
ORDER BY count DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Payments daily totals (last 90 days for cross-check)
-- ═══════════════════════════════════════════════════════════════════
SELECT
  DATE(created_at) AS payment_date,
  COUNT(*) AS count,
  COALESCE(SUM(amount), 0) AS total_amount
FROM payment.payments
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY payment_date DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Provider settlements — count + gross + commission + tax + net
-- ═══════════════════════════════════════════════════════════════════
SELECT
  'SETTLEMENTS' AS entity,
  COUNT(*) AS total_count,
  COALESCE(SUM(gross_amount), 0) AS gross_payable,
  COALESCE(SUM(commission), 0) AS total_commission,
  COALESCE(SUM(gst_amount), 0) AS total_gst,
  COALESCE(SUM(tds_amount), 0) AS total_tds,
  COALESCE(SUM(tcs_amount), 0) AS total_tcs,
  COALESCE(SUM(net_amount), 0) AS net_payout
FROM provider.provider_settlements;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Provider settlements by status
-- ═══════════════════════════════════════════════════════════════════
SELECT
  settlement_status,
  COUNT(*) AS count,
  COALESCE(SUM(gross_amount), 0) AS gross,
  COALESCE(SUM(net_amount), 0) AS net
FROM provider.provider_settlements
GROUP BY settlement_status
ORDER BY count DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Customer wallets — count + balance total
-- ═══════════════════════════════════════════════════════════════════
SELECT
  'CUSTOMER_WALLETS' AS entity,
  COUNT(*) AS wallet_count,
  COALESCE(SUM(balance), 0) AS total_balance
FROM payment.customer_wallets;

-- ═══════════════════════════════════════════════════════════════════
-- 7. Customer wallet transactions — credit/debit totals
-- ═══════════════════════════════════════════════════════════════════
SELECT
  type,
  COUNT(*) AS count,
  COALESCE(SUM(amount), 0) AS total_amount
FROM payment.customer_wallet_transactions
GROUP BY type
ORDER BY count DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 8. Customer wallet balance vs ledger reconciliation
-- ═══════════════════════════════════════════════════════════════════
-- This query finds wallets where materialized balance != computed balance.
-- MUST return 0 rows. Any row here is a data integrity issue.
SELECT
  cw.user_id,
  cw.balance AS materialized_balance,
  COALESCE(SUM(
    CASE
      WHEN cwt.type IN ('promo_credit', 'referral_credit', 'cashback', 'refund_credit') THEN cwt.amount
      WHEN cwt.type IN ('booking_debit', 'expiry_debit') THEN -cwt.amount
      ELSE 0
    END
  ), 0) AS computed_delta,
  cw.balance - COALESCE(SUM(
    CASE
      WHEN cwt.type IN ('promo_credit', 'referral_credit', 'cashback', 'refund_credit') THEN cwt.amount
      WHEN cwt.type IN ('booking_debit', 'expiry_debit') THEN -cwt.amount
      ELSE 0
    END
  ), 0) AS mismatch
FROM payment.customer_wallets cw
LEFT JOIN payment.customer_wallet_transactions cwt ON cwt.user_id = cw.user_id
GROUP BY cw.user_id, cw.balance
HAVING cw.balance != COALESCE(SUM(
  CASE
    WHEN cwt.type IN ('promo_credit', 'referral_credit', 'cashback', 'refund_credit') THEN cwt.amount
    WHEN cwt.type IN ('booking_debit', 'expiry_debit') THEN -cwt.amount
    ELSE 0
  END
), 0);

-- ═══════════════════════════════════════════════════════════════════
-- 9. Provider wallets — count + balance total
-- ═══════════════════════════════════════════════════════════════════
SELECT
  'PROVIDER_WALLETS' AS entity,
  COUNT(*) AS provider_count,
  COALESCE(SUM("walletBalance"), 0) AS total_balance,
  COALESCE(SUM("reservedBalance"), 0) AS total_reserved,
  COALESCE(SUM("creditLimit"), 0) AS total_credit_limit
FROM provider.providers
WHERE wallet_initialized = true;

-- ═══════════════════════════════════════════════════════════════════
-- 10. Accounting journal balance verification
-- Must return 0 rows. Any row = unbalanced journal.
-- ═══════════════════════════════════════════════════════════════════
SELECT
  je.id AS journal_entry_id,
  je.transaction_id,
  SUM(jl.debit) AS total_debit,
  SUM(jl.credit) AS total_credit,
  SUM(jl.debit) - SUM(jl.credit) AS imbalance
FROM accounting.journal_entries je
JOIN accounting.journal_lines jl ON jl.journal_entry_id = je.id
GROUP BY je.id, je.transaction_id
HAVING SUM(jl.debit) != SUM(jl.credit);

-- ═══════════════════════════════════════════════════════════════════
-- 11. Booking count by status
-- ═══════════════════════════════════════════════════════════════════
SELECT
  status,
  COUNT(*) AS count
FROM booking.bookings
GROUP BY status
ORDER BY count DESC;

-- ═══════════════════════════════════════════════════════════════════
-- EXPECTED RESULTS FOR CUTOVER APPROVAL:
-- ═══════════════════════════════════════════════════════════════════
-- Query 8  → 0 rows (no wallet mismatches)
-- Query 10 → 0 rows (no unbalanced journals)
-- Queries 1-7, 9, 11 → counts and sums match Mongo aggregation output
