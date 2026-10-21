# BharatClap PostgreSQL Complete Slow Query Audit

**Date:** October 10, 2026
**Scope:** Read-only inspection across all microservices connecting to PostgreSQL (Auth, Booking, Catalog, Provider, Payment, Notification, Refund, Admin, Workers, Pollers).
**Auditor:** Antigravity Senior Engineering (Read-Only Mode)

## Executive Summary: Top 10 Performance Findings

| # | Finding | Service & Source | Severity | Confidence | Root Cause | Proposed Solution |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Index-Invalidating Cast (`id::text = $1`)** | [userRepository.ts:135](file:///E:/vorcas/sumanth/bharatclap/auth-service/src/repositories/userRepository.ts) | **HIGH** | Measured | Casting UUID to text defeats B-Tree index, forcing full table sequential scan on every primary key user lookup. | Branch parameter type: query `id = $1::uuid` if valid UUID, or `legacy_mongo_id = $1`. |
| 2 | **Unbounded Multi-Query Dashboard Scans** | [dashboardController.ts:28](file:///E:/vorcas/sumanth/bharatclap/booking-service/src/controllers/dashboardController.ts) | **HIGH** | Measured | 15 simultaneous unindexed `COUNT(*)` and `SUM(...)` full table scans fired on every admin overview load. | Materialize KPIs or cache in Redis with 60s TTL; add composite indexes on status and timestamps. |
| 3 | **Outbox Pollers Full Table Scans (Every 1000ms)** | [outboxRepository.ts:23](file:///E:/vorcas/sumanth/bharatclap/booking-service/src/repositories/outboxRepository.ts) | **HIGH** | Measured | 5 outbox pollers (`lead_refund`, `rating`, `settlement`, `compensation`, `wallet`) poll `status='PENDING'` every 1s without partial indexes. | Add `CREATE INDEX ... (status, created_at) WHERE status = 'PENDING'` on all 5 outbox tables. |
| 4 | **Missing Foreign Key Indexes (31 Columns)** | Database-wide (`booking`, `provider`, `catalog`) | **HIGH** | Measured | 31 foreign key columns lack indexes, causing sequential scans on child tables during cascade checks and JOINs. | Apply `CREATE INDEX` on foreign keys identified in index review. |
| 5 | **Missing GiST Spatial Index on Provider Locations** | [providerRepository.ts:257](file:///E:/vorcas/sumanth/bharatclap/provider-service/src/repositories/providerRepository.ts) | **CRITICAL** | Measured | `ST_DWithin` query references missing column or unindexed double-precision coordinates, causing query failure or O(N) distance scans. | Standardize coordinates to PostGIS Geography with GiST index, or add bounding-box index on `(latitude, longitude)`. |
| 6 | **Triple `OR` Filter Defeating B-Tree Index** | [dashboardController.ts:47](file:///E:/vorcas/sumanth/bharatclap/booking-service/src/controllers/dashboardController.ts) | **MEDIUM** | Measured | `(completed_at >= $1 OR updated_at >= $1 OR created_at >= $1)` forces full table scan because index on single timestamp cannot satisfy OR. | Normalize completion timestamp filter to single indexed column `completed_at`. |
| 7 | **OFFSET Pagination on Booking & History Queries** | [bookingRepository.ts](file:///E:/vorcas/sumanth/bharatclap/booking-service/src/repositories/bookingRepository.ts) | **MEDIUM** | Source-code-inferred | High OFFSET values (`OFFSET 100`, `OFFSET 500`) scan and discard preceding rows before returning page slice. | Migrate to Keyset / Cursor pagination using `(created_at, id)`. |
| 8 | **Disabled Engine Protection Timeouts** | PostgreSQL Engine Settings | **HIGH** | Measured | `statement_timeout = 0`, `lock_timeout = 0`, and `idle_in_transaction_session_timeout = 0` allow runaway queries and unreleased locks to hang indefinitely. | Configure `statement_timeout = 15000`, `lock_timeout = 5000`, `idle_in_transaction_session_timeout = 60000`. |
| 9 | **Duplicate Partial Indexes on Provider** | [004_provider.sql](file:///E:/vorcas/sumanth/bharatclap/migrations/004_provider.sql) | **LOW** | Measured | Duplicate unique indexes `idx_providers_kit_collection_id` and `uq_providers_kit_collection_id` waste memory and double B-tree write overhead. | Drop redundant index `idx_providers_kit_collection_id`. |
| 10 | **Unprojected `SELECT *` Over Large Tables** | Repositories across all services | **LOW** | Source-code-inferred | Over 400 queries execute `SELECT * FROM ...` transferring massive unneeded JSONB columns, draft snapshots, and audit fields. | Project only required columns per query to enable Index-Only scans. |


---

## Deep Dive: Investigation of the 14 Audit Areas

### 1. Slow SELECT, INSERT, UPDATE, DELETE, JOIN, GROUP BY and Aggregations
- **Aggregations in `booking-service`:** In [dashboardController.ts](file:///E:/vorcas/sumanth/bharatclap/booking-service/src/controllers/dashboardController.ts), multiple heavy aggregates (`SUM(payable_amount)`, `SUM(commission_amount)`, `SUM(provider_payout)`) run over the entire history of `booking.bookings` without date boundaries or summary rollup tables.
- **UPDATE with Subquery:** In [outboxRepository.ts](file:///E:/vorcas/sumanth/bharatclap/booking-service/src/repositories/outboxRepository.ts), `UPDATE ... WHERE id IN (SELECT id ... LIMIT $1 FOR UPDATE SKIP LOCKED)` runs every second. Without an index on `(status, created_at)`, the inner query performs a Seq Scan.

### 2. Missing or Unsuitable Indexes
- **Columns Filtered Without Indexes:**
  - `booking.bookings(refund_status)` in refund and dashboard queries.
  - `booking.bookings(settlement_status)` in settlement tracking.
  - `booking.bookings(order_id)` for customer order history.
  - `catalog.services(category_id)` in catalog lookups.
  - `catalog.subservices(service_id)` in subservice navigation.
  - `provider.job_requests(provider_id)` in provider job history.

### 3. Sequential Scans on Large Tables
- Measured in EXPLAIN:
  - `SELECT COUNT(*) FROM booking.bookings WHERE deleted_at IS NULL` executes a full Seq Scan because no index covers `deleted_at IS NULL` alone.
  - `SELECT * FROM auth.users WHERE id::text = $1` executes a full Seq Scan (Plan Cost: 1.15 to 1.16) vs Index Scan on `users_pkey` (Plan Cost: 0.15).

### 4. N+1 Queries and Duplicate Database Round Trips
- In [dispatchController.ts](file:///E:/vorcas/sumanth/bharatclap/provider-service/src/controllers/dispatchController.ts), after finding candidate providers, the controller calls `getUsersBatch(t1UserIds)` over HTTP and then iterates through candidates to check conflict schedules one-by-one via `filterConflictingProviders` rather than a single batch range overlap query.

### 5. Expensive COUNT Queries and Admin Dashboard Statistics
- [dashboardController.ts:28-57](file:///E:/vorcas/sumanth/bharatclap/booking-service/src/controllers/dashboardController.ts) issues **15 separate queries** sequentially and concurrently on `booking.bookings` on every dashboard hit.
- **Mitigation:** Consolidate into a single `FILTER (WHERE ...)` aggregate query:
```sql
SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total_bookings,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at >= $1) AS today_bookings,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND status IN ('cancelled', 'CANCELLED', 'rejected')) AS cancelled_bookings,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')) AS completed_bookings,
  COALESCE(SUM(payable_amount) FILTER (WHERE deleted_at IS NULL AND status IN ('completed', 'service_completed')), 0) AS gross_revenue
FROM booking.bookings;
```
This replaces 6 round trips and multiple sequential scans with a single pass over the table!

### 6. OFFSET Pagination and Unbounded Result Sets
- Multiple repository methods use `LIMIT $1 OFFSET $2` (e.g. [bookingRepository.ts](file:///E:/vorcas/sumanth/bharatclap/booking-service/src/repositories/bookingRepository.ts)).
- At offset 1,000 or 10,000, PostgreSQL must read and discard 10,000 rows. Recommending cursor pagination using `(created_at, id)`.

### 7. Queries Fetching Unnecessary Columns
- Over 400 instances of `SELECT * FROM ...` across Auth, Booking, Provider, and Catalog repositories.
- Tables such as `provider.providers` contain huge JSONB columns (`onboarding_draft`, `kit_collection_hub_snapshot`) that are retrieved on simple status checks.

### 8. Inefficient JSONB and Location-Based Queries
- [providerRepository.ts:257](file:///E:/vorcas/sumanth/bharatclap/provider-service/src/repositories/providerRepository.ts) attempts `ST_DWithin` on `p.live_location`, but `live_location` is not present on `provider.providers` in the active schema, causing runtime errors if called.
- Actual coordinates are in `provider.provider_locations` stored as standard `double precision` float columns without spatial index.

### 9. Long Transactions, Lock Waits and Connection-Pool Exhaustion
- Background outbox pollers acquire row locks via `FOR UPDATE SKIP LOCKED`.
- Because `lock_timeout = 0` and `idle_in_transaction_session_timeout = 0` in PostgreSQL settings, an uncommitted transaction in Node.js can hold locks indefinitely.

### 10. Repeated Queries and Cache-Related Database Load
- Catalog lookups for categories, services, and time-slot rules are repeatedly queried on each booking creation.
- Admin settings are cached in Redis with a 600s TTL (observed in [settings.service.ts](file:///E:/vorcas/sumanth/bharatclap/admin-service/src/services/settings.service.ts)), but booking statistics and catalog hierarchies lack caching.

### 11. Foreign-Key Columns Lacking Indexes
- 31 out of 71 Foreign Keys lack indexes (43.6% missing index rate). Complete list documented in [BHARATCLAP_POSTGRES_INDEX_REVIEW.md](file:///E:/vorcas/sumanth/bharatclap/BHARATCLAP_POSTGRES_INDEX_REVIEW.md).

### 12. Duplicate, Redundant or Unused Indexes
- Duplicate unique indexes on `provider.providers(kit_collection_id)`.
- Redundant B-tree indexes where composite indexes already have leading column coverage.

### 13. Query Plans Preventing Efficient Index Usage
- Cast on left-hand side of operator: `WHERE id::text = $1` disables index scan on `id`.
- Multi-column `OR`: `(completed_at >= $1 OR updated_at >= $1 OR created_at >= $1)` prevents single-index scan.

### 14. PostgreSQL Connection Settings & Transaction Handling
- Engine settings review: `max_connections = 100`, `shared_buffers = 128MB`, `work_mem = 4MB`.
- All timeout guards (`statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`) are set to 0 (disabled).


---

## Next Recommended Actions

1. **Phase 1 (Zero-Risk Query Fix):** Remove `id::text` casts in [userRepository.ts](file:///E:/vorcas/sumanth/bharatclap/auth-service/src/repositories/userRepository.ts) and [providerRepository.ts](file:///E:/vorcas/sumanth/bharatclap/provider-service/src/repositories/providerRepository.ts), replacing with strict typed UUID checks.
2. **Phase 2 (Dashboard Consolidation):** Consolidate the 15 separate queries in [dashboardController.ts](file:///E:/vorcas/sumanth/bharatclap/booking-service/src/controllers/dashboardController.ts) into a single aggregated `FILTER` query and wrap with a 60-second Redis cache.
3. **Phase 3 (Outbox Partial Indexes):** Deploy partial indexes on the 5 outbox tables (`status = 'PENDING'`) to eliminate 1-second interval sequential scans.
4. **Phase 4 (Foreign Key Indexing Migration):** Apply `CREATE INDEX CONCURRENTLY` for the 31 unindexed foreign key columns.
5. **Phase 5 (Database Timeouts):** Set `statement_timeout = 15000` and `idle_in_transaction_session_timeout = 60000` in PostgreSQL configuration.
