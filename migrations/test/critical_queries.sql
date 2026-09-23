-- critical_queries.sql
-- BharatClap — Critical queries for EXPLAIN (ANALYZE, BUFFERS) validation
-- Run these against a staging database WITH representative data volumes.
-- Watch for: Seq Scan, large sorts, nested-loop explosions, poor selectivity.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Customer lookup by phone (auth service, every login)
-- ═══════════════════════════════════════════════════════════════════
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, name, email, role, wallet_status
FROM auth.users
WHERE phone = '+919876543210';

-- ═══════════════════════════════════════════════════════════════════
-- 2. Provider search by location + service + availability
-- ═══════════════════════════════════════════════════════════════════
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT p.id, p.user_id, p.rating, p.total_completed_jobs
FROM provider.providers p
JOIN provider.provider_services ps ON ps.provider_id = p.id
WHERE ps.subservice_id = '00000000-0000-0000-0000-000000000001'
  AND p.is_available = true
  AND p.is_verified = true
  AND p.is_active = true
ORDER BY p.rating DESC
LIMIT 20;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Booking availability (slot capacity check)
-- ═══════════════════════════════════════════════════════════════════
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT slot, booked_count, max_capacity
FROM booking.slot_capacities
WHERE provider_id = '00000000-0000-0000-0000-000000000001'
  AND slot_date = CURRENT_DATE
  AND booked_count < max_capacity;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Provider's active bookings (provider app home screen)
-- ═══════════════════════════════════════════════════════════════════
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT b.id, b.booking_id, b.status, b.scheduled_at, b.booking_time
FROM booking.bookings b
WHERE b.provider_id = '00000000-0000-0000-0000-000000000001'
  AND b.status IN ('accepted', 'confirmed', 'on_the_way', 'arrived', 'in_progress')
ORDER BY b.scheduled_at ASC
LIMIT 20;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Customer payment history
-- ═══════════════════════════════════════════════════════════════════
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT p.id, p.amount, p.payment_status, p.payment_method, p.created_at
FROM payment.payments p
WHERE p.user_id = '00000000-0000-0000-0000-000000000001'
ORDER BY p.created_at DESC
LIMIT 20;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Customer wallet transaction history
-- ═══════════════════════════════════════════════════════════════════
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT type, amount, balance_after, reference_type, description, created_at
FROM payment.customer_wallet_transactions
WHERE user_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC
LIMIT 50;

-- ═══════════════════════════════════════════════════════════════════
-- 7. Provider wallet transaction history (with hash chain)
-- ═══════════════════════════════════════════════════════════════════
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT type, amount, "balanceAfter", "referenceId", fencing_token, created_at
FROM provider.wallet_transactions
WHERE provider_id = '00000000-0000-0000-0000-000000000001'
  AND status = 'success'
ORDER BY created_at DESC
LIMIT 50;

-- ═══════════════════════════════════════════════════════════════════
-- 8. Settlement dashboard (admin, aggregation)
-- ═══════════════════════════════════════════════════════════════════
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  ps.settlement_status,
  COUNT(*) AS count,
  SUM(ps.gross_amount) AS total_gross,
  SUM(ps.net_amount) AS total_net,
  SUM(ps.commission) AS total_commission
FROM provider.provider_settlements ps
WHERE ps.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ps.settlement_status;

-- ═══════════════════════════════════════════════════════════════════
-- 9. Admin Customer360 (single customer, all related data)
-- ═══════════════════════════════════════════════════════════════════
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.id, u.name, u.phone, u.email, u.role,
       cw.balance AS wallet_balance,
       (SELECT COUNT(*) FROM booking.bookings WHERE user_id = u.id) AS booking_count,
       (SELECT COUNT(*) FROM payment.payments WHERE user_id = u.id) AS payment_count
FROM auth.users u
LEFT JOIN payment.customer_wallets cw ON cw.user_id = u.id
WHERE u.id = '00000000-0000-0000-0000-000000000001';

-- ═══════════════════════════════════════════════════════════════════
-- 10. Finance explorer (journal entries for a booking)
-- ═══════════════════════════════════════════════════════════════════
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT je.id, je.transaction_id, je.description, je.posted_at,
       jl.account_id, coa.name AS account_name, jl.debit, jl.credit
FROM accounting.journal_entries je
JOIN accounting.journal_lines jl ON jl.journal_entry_id = je.id
JOIN accounting.chart_of_accounts coa ON coa.id = jl.account_id
WHERE je.booking_id = '00000000-0000-0000-0000-000000000001'
ORDER BY je.posted_at DESC;

-- ═══════════════════════════════════════════════════════════════════
-- After running, look for:
-- ═══════════════════════════════════════════════════════════════════
-- ❌ Seq Scan on large tables (need index)
-- ❌ Sort with high row count (need index or LIMIT push-down)
-- ❌ Nested Loop with large inner table (consider Hash Join)
-- ❌ Buffers: shared read >> shared hit (cold cache, may be OK on first run)
-- ❌ Rows Removed by Filter >> actual rows (poor selectivity)
-- ✅ Index Scan / Index Only Scan
-- ✅ Bitmap Index Scan for multi-column filters
-- ✅ Hash Join for JOINs on large tables
