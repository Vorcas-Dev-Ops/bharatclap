# BharatClap PostgreSQL Performance Baseline

**Observation Date:** October 10, 2026
**PostgreSQL Version:** 18.1 (64-bit Windows)
**Database Name:** `bharatclap_migration_test`
**Observation Status:** Clean Read-Only Snapshot

## 1. Engine Configuration & Resource Baseline

| Parameter | Setting | Unit | Description | Assessment |
| :--- | :--- | :--- | :--- | :--- |
| `effective_cache_size` | `524288` | 8kB | Sets the planner's assumption about the total size of the data caches. | Standard |
| `effective_io_concurrency` | `16` | - | Number of simultaneous requests that can be handled efficiently by the disk subsystem. | Standard |
| `idle_in_transaction_session_timeout` | `0` | ms | Sets the maximum allowed idle time between queries, when in a transaction. | ⚠️ DISABLED: Unclosed tx can block VACUUM |
| `lock_timeout` | `0` | ms | Sets the maximum allowed duration of any wait for a lock. | ⚠️ DISABLED: Vulnerable to indefinite lock queues |
| `maintenance_work_mem` | `65536` | kB | Sets the maximum memory to be used for maintenance operations. | Standard |
| `max_connections` | `100` | - | Sets the maximum number of concurrent connections. | Standard |
| `random_page_cost` | `4` | - | Sets the planner's estimate of the cost of a nonsequentially fetched disk page. | ℹ️ Default spinning-disk cost; recommend 1.1 for SSDs |
| `shared_buffers` | `16384` | 8kB | Sets the number of shared memory buffers used by the server. | Standard |
| `statement_timeout` | `0` | ms | Sets the maximum allowed duration of any statement. | ⚠️ DISABLED: Vulnerable to runaway queries |
| `synchronous_commit` | `on` | - | Sets the current transaction's synchronization level. | Standard |
| `wal_level` | `replica` | - | Sets the level of information written to the WAL. | Standard |
| `work_mem` | `4096` | kB | Sets the maximum memory to be used for query workspaces. | Standard |

---

## 2. Table Storage & Scan Statistics

| Schema | Table | Estimated Rows | Total Size | Table Size | Index Size | Seq Scans | Index Scans |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `provider` | `wallet_transactions` | 2354 | 2384 kB | 1520 kB | 824 kB | 325 | 3494 |
| `provider` | `wallet_audit_logs` | 2360 | 1960 kB | 1800 kB | 120 kB | 11 | 1 |
| `notification` | `notification_deliveries` | 4130 | 1112 kB | 472 kB | 600 kB | 79 | 4198 |
| `catalog` | `categories` | 1 | 456 kB | 8192 bytes | 56 kB | 52 | 15179 |
| `auth` | `users` | 261 | 376 kB | 56 kB | 280 kB | 26306 | 4757 |
| `provider` | `providers` | 221 | 368 kB | 120 kB | 184 kB | 16191 | 9834 |
| `provider` | `job_requests` | 202 | 360 kB | 184 kB | 136 kB | 4452 | 17427 |
| `booking` | `bookings` | 48 | 232 kB | 24 kB | 168 kB | 132589 | 33012 |
| `auth` | `refresh_tokens` | 45 | 144 kB | 16 kB | 88 kB | 1000 | 35 |
| `provider` | `provider_settlements` | 13 | 128 kB | 8192 bytes | 112 kB | 102 | 856 |
| `booking` | `event_outbox` | 65 | 128 kB | 40 kB | 48 kB | 163346 | 409406 |
| `auth` | `otp_challenges` | 65 | 120 kB | 16 kB | 72 kB | 114 | 81 |
| `notification` | `notifications` | 121 | 120 kB | 48 kB | 40 kB | 886 | 0 |
| `notification` | `campaigns` | 42 | 96 kB | 16 kB | 48 kB | 6380 | 20 |
| `accounting` | `journal_entries` | 0 | 96 kB | 8192 bytes | 80 kB | 0 | 0 |
| `payment` | `payments` | 2 | 96 kB | 8192 bytes | 80 kB | 5800 | 908 |
| `provider` | `wallets` | 19 | 96 kB | 16 kB | 40 kB | 5689 | 748 |
| `notification` | `processed_events` | 65 | 88 kB | 16 kB | 40 kB | 0 | 65 |
| `booking` | `booking_activities` | 9 | 80 kB | 8192 bytes | 32 kB | 105 | 260 |
| `payment` | `customer_wallet_transactions` | 0 | 72 kB | 8192 bytes | 56 kB | 0 | 728 |
| `provider` | `provider_orders` | 1 | 72 kB | 8192 bytes | 56 kB | 121 | 0 |
| `catalog` | `banners` | 5 | 72 kB | 8192 bytes | 56 kB | 134 | 1209 |
| `auth` | `addresses` | 4 | 72 kB | 8192 bytes | 56 kB | 896 | 459 |
| `provider` | `processed_webhook_events` | 0 | 64 kB | 8192 bytes | 48 kB | 3 | 29 |
| `provider` | `kit_collection_audit_logs` | 1 | 64 kB | 8192 bytes | 48 kB | 3 | 36 |
| `payment` | `refund_event_outbox` | 2 | 64 kB | 8192 bytes | 48 kB | 3 | 12 |
| `payment` | `webhook_logs` | 0 | 56 kB | 8192 bytes | 40 kB | 0 | 0 |
| `catalog` | `services` | 7 | 56 kB | 8192 bytes | 40 kB | 24937 | 1165 |
| `accounting` | `journal_lines` | 0 | 56 kB | 8192 bytes | 48 kB | 0 | 0 |
| `payment` | `customer_wallets` | 0 | 56 kB | 8192 bytes | 40 kB | 0 | 728 |

---

## 3. Representative Query EXPLAIN Baselines (Measured)

### Q1_dashboard_total_bookings
- **Top Node:** `Aggregate`
- **Estimated Startup Cost:** `3.9`
- **Estimated Total Cost:** `3.91`
- **Estimated Rows:** `1`
- **Scan Type:** `Seq Scan`

```sql
SELECT COUNT(*)::int AS count FROM booking.bookings WHERE deleted_at IS NULL
```

### Q2_dashboard_revenue_aggregation
- **Top Node:** `Aggregate`
- **Estimated Startup Cost:** `4.35`
- **Estimated Total Cost:** `4.36`
- **Estimated Rows:** `1`
- **Scan Type:** `Seq Scan`

```sql

        SELECT 
          COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS gross,
          COALESCE(SUM(CASE WHEN COALESCE(commission_amount, 0) > 0 THEN commission_amount ELSE COALESCE(payable_amount, service_price, 0) * 0.15 END), 0)::float AS commission,
          COALESCE(SUM(CASE WHEN COALESCE(provider_payout, 0) > 0 THEN provider_payout ELSE COALESCE(payable_amount, service_price, 0) * 0.85 END), 0)::float AS provider_payout
        FROM booking.bookings
        WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')
```

### Q3_dashboard_triple_or_today_revenue
- **Top Node:** `Aggregate`
- **Estimated Startup Cost:** `5.53`
- **Estimated Total Cost:** `5.55`
- **Estimated Rows:** `1`
- **Scan Type:** `Seq Scan`

```sql

        SELECT 
          COALESCE(SUM(COALESCE(payable_amount, service_price, 0)), 0)::float AS gross,
          COALESCE(SUM(CASE WHEN COALESCE(commission_amount, 0) > 0 THEN commission_amount ELSE COALESCE(payable_amount, service_price, 0) * 0.15 END), 0)::float AS commission
        FROM booking.bookings
        WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')
          AND (completed_at >= NOW() - INTERVAL '1 day' OR updated_at >= NOW() - INTERVAL '1 day' OR created_at >= NOW() - INTERVAL '1 day')
```

### Q4_dashboard_stuck_accepted_2h
- **Top Node:** `Aggregate`
- **Estimated Startup Cost:** `4.45`
- **Estimated Total Cost:** `4.46`
- **Estimated Rows:** `1`
- **Scan Type:** `Seq Scan`

```sql

        SELECT COUNT(*)::int AS count 
        FROM booking.bookings 
        WHERE deleted_at IS NULL AND status = 'accepted' AND accepted_at <= NOW() - INTERVAL '2 hours'
```

### Q5_dashboard_pending_refunds_unindexed
- **Top Node:** `Aggregate`
- **Estimated Startup Cost:** `3.9`
- **Estimated Total Cost:** `3.91`
- **Estimated Rows:** `1`
- **Scan Type:** `Seq Scan`

```sql

        SELECT COUNT(*)::int AS count 
        FROM booking.bookings 
        WHERE deleted_at IS NULL AND refund_status IN ('initiated', 'processing')
```

### Q6_dashboard_settlement_status_unindexed
- **Top Node:** `Aggregate`
- **Estimated Startup Cost:** `3.99`
- **Estimated Total Cost:** `4.01`
- **Estimated Rows:** `1`
- **Scan Type:** `Seq Scan`

```sql

        SELECT COUNT(*)::int AS count 
        FROM booking.bookings 
        WHERE deleted_at IS NULL AND settlement_status IN ('Queued', 'Created', 'Ready')
```

### Q7_provider_find_nearby_spatial
> [!WARNING]
> **Execution Error:** column p.live_location does not exist

### Q8_booking_history_pagination_offset
- **Top Node:** `Limit`
- **Estimated Startup Cost:** `3.91`
- **Estimated Total Cost:** `3.92`
- **Estimated Rows:** `1`
- **Scan Type:** `Sort`

```sql

        SELECT * 
        FROM booking.bookings 
        WHERE user_id = '00000000-0000-0000-0000-000000000000' AND deleted_at IS NULL
        ORDER BY created_at DESC 
        LIMIT 20 OFFSET 100
```

### Q11_cast_id_text_scan
- **Top Node:** `Limit`
- **Estimated Startup Cost:** `0`
- **Estimated Total Cost:** `6.11`
- **Estimated Rows:** `1`
- **Scan Type:** `Seq Scan`

```sql

        SELECT * FROM auth.users 
        WHERE id::text = 'a0000000-0000-0000-0000-000000000000' OR legacy_mongo_id = 'a0000000-0000-0000-0000-000000000000' 
        LIMIT 1
```

### Q12_uuid_param_index_scan
- **Top Node:** `Limit`
- **Estimated Startup Cost:** `0.27`
- **Estimated Total Cost:** `8.29`
- **Estimated Rows:** `1`
- **Scan Type:** `Index Scan`

```sql

        SELECT * FROM auth.users 
        WHERE id = 'a0000000-0000-0000-0000-000000000000'::uuid 
        LIMIT 1
```

### Q13_booking_order_id_unindexed
- **Top Node:** `Seq Scan`
- **Estimated Startup Cost:** `0`
- **Estimated Total Cost:** `3.9`
- **Estimated Rows:** `1`
- **Scan Type:** `Seq Scan`

```sql

        SELECT * FROM booking.bookings 
        WHERE order_id = 'a0000000-0000-0000-0000-000000000000'::uuid
```

### Q14_payment_booking_id_unindexed
- **Top Node:** `Index Scan`
- **Estimated Startup Cost:** `0.14`
- **Estimated Total Cost:** `8.16`
- **Estimated Rows:** `1`
- **Scan Type:** `Index Scan`

```sql

        SELECT * FROM payment.payments 
        WHERE booking_id = 'a0000000-0000-0000-0000-000000000000'::uuid
```

## 4. Runtime Statistics & `pg_stat_statements` Status
- **pg_stat_statements:** `NOT INSTALLED / UNAVAILABLE` (relation `pg_stat_statements` does not exist).
- **Observation Period:** Point-in-time read-only audit during active migration and development testing.
- **Statistical Limitations:** Because `pg_stat_statements` is not enabled in `shared_preload_libraries`, cumulative statement timings (calls, mean_time, total_time) cannot be recorded from engine telemetry without approval to enable the extension and restart the database service.
