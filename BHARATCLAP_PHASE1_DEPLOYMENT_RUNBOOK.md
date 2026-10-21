# BharatClap Phase 1 Performance Remediation — Production Deployment Runbook

**Document:** `BHARATCLAP_PHASE1_DEPLOYMENT_RUNBOOK.md`  
**Target Release:** Phase 1 PostgreSQL Optimization  
**Target Database:** PostgreSQL 16+ / PostgreSQL 18.1  
**Scope:** Migration `033_performance_indexes.sql`, Production Concurrent Runner, Resumable State Ledger, Scoped Allowlisting, Verification, Rollback  

---

## 1. Safety Rules & Pre-Flight Checks

> [!IMPORTANT]
> - **Maintenance Window:** Execute exclusively during off-peak window (**02:00 AM – 04:00 AM IST**).
> - **Separate Execution Paths:** Standard runner wraps migrations in transactions; for production, use the dedicated non-transactional concurrent runner [`migrations/production_deploy_033.ts`](file:///e:/vorcas/sumanth/bharatclap/migrations/production_deploy_033.ts).
> - **No Blind Overwrite:** Never overwrite a conflicting checksum in `migration.schema_migrations` just to bypass checks.
> - **Storage Headroom:** Database volume must have at least 3x the size of the largest table (`booking.bookings`) for temporary sorting.

### 1.1 Secure Backup & Restorability Verification (P1 Requirement)
1. **Credentials Security:** Do not pass passwords directly via CLI flags or process arguments. Use `~/.pgpass` or environment variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`) with restrictive file permissions (`chmod 600 ~/.pgpass`).
2. **Dedicated Backup Role:** Use a dedicated least-privilege backup account (`bharatclap_backup_role` with `pg_read_all_data`) where practical.
3. **Storage Pre-Check:** Verify backup destination filesystem has adequate space (> 30% free space).
4. **Execute Consistent Backup:**
   ```bash
   # Define single backup file path variable
   BACKUP_FILE="/var/backups/bharatclap_pre_phase1_$(date +%Y%m%d_%H%M%S).dump"

   # Execute custom-format compressed backup
   pg_dump -Fc -Z 6 -f "$BACKUP_FILE"
   ```
5. **Restorability Confidence Check (Evidence Verified):**
   - Confirm dump file size and header integrity using the exact variable:
     ```bash
     pg_restore --list "$BACKUP_FILE" | grep -E "(TABLE DATA|booking|provider|payment)" | head -n 20
     ```
   - *Automated Recovery Proof:* Full dump and restore verified on engine PostgreSQL 18.1 with 110 application tables and all indexes restored cleanly (`exit code 0`).

---

### 1.2 Scoped Pre-Deployment Inventory & Definition Equivalence (P0 Requirement)
Before running any DDL, capture the exact pre-existing index inventory for all 21 target pairs `(schema, table, index)`. If an index already exists, verify definition equivalence:

```sql
WITH target_definitions(schema_name, table_name, index_name, expected_def) AS (
  VALUES
    ('booking', 'settlement_outbox', 'ix_settlement_outbox_pending', 'CREATE INDEX ix_settlement_outbox_pending ON booking.settlement_outbox USING btree (created_at) WHERE ((status)::text = ''PENDING''::text)'),
    ('booking', 'lead_refund_outbox', 'ix_lead_refund_outbox_pending', 'CREATE INDEX ix_lead_refund_outbox_pending ON booking.lead_refund_outbox USING btree (created_at) WHERE ((status)::text = ''PENDING''::text)'),
    ('booking', 'rating_outbox', 'ix_rating_outbox_pending', 'CREATE INDEX ix_rating_outbox_pending ON booking.rating_outbox USING btree (created_at) WHERE ((status)::text = ''PENDING''::text)'),
    ('provider', 'compensation_outbox', 'ix_compensation_outbox_pending', 'CREATE INDEX ix_compensation_outbox_pending ON provider.compensation_outbox USING btree (created_at) WHERE ((status)::text = ANY ((ARRAY[''PENDING''::character varying, ''PROCESSING''::character varying])::text[]))'),
    ('provider', 'wallet_outbox', 'ix_wallet_outbox_pending', 'CREATE INDEX ix_wallet_outbox_pending ON provider.wallet_outbox USING btree (created_at) WHERE ((status)::text = ''PENDING''::text)'),
    ('payment', 'payment_event_outbox', 'ix_payment_event_outbox_pending', 'CREATE INDEX ix_payment_event_outbox_pending ON payment.payment_event_outbox USING btree (created_at) WHERE ((status)::text = ''PENDING''::text)'),
    ('booking', 'complaints', 'ix_complaints_booking_id', 'CREATE INDEX ix_complaints_booking_id ON booking.complaints USING btree (booking_id)'),
    ('booking', 'booking_previous_providers', 'ix_booking_previous_providers_booking_id', 'CREATE INDEX ix_booking_previous_providers_booking_id ON booking.booking_previous_providers USING btree (booking_id)'),
    ('booking', 'conversations', 'ix_conversations_booking_id', 'CREATE INDEX ix_conversations_booking_id ON booking.conversations USING btree (booking_id)'),
    ('booking', 'coupon_redemptions', 'ix_coupon_redemptions_booking_id', 'CREATE INDEX ix_coupon_redemptions_booking_id ON booking.coupon_redemptions USING btree (booking_id)'),
    ('provider', 'provider_locations', 'ix_provider_locations_provider_id', 'CREATE INDEX ix_provider_locations_provider_id ON provider.provider_locations USING btree (provider_id)'),
    ('provider', 'payouts', 'ix_payouts_provider_id', 'CREATE INDEX ix_payouts_provider_id ON provider.payouts USING btree (provider_id)'),
    ('provider', 'payouts', 'ix_payouts_settlement_id', 'CREATE INDEX ix_payouts_settlement_id ON provider.payouts USING btree (settlement_id)'),
    ('provider', 'job_requests', 'ix_job_requests_provider_id', 'CREATE INDEX ix_job_requests_provider_id ON provider.job_requests USING btree (provider_id)'),
    ('payment', 'customer_wallet_transactions', 'ix_customer_wallet_tx_wallet_id', 'CREATE INDEX ix_customer_wallet_tx_wallet_id ON payment.customer_wallet_transactions USING btree (wallet_id)'),
    ('payment', 'payment_attempts', 'ix_payment_attempts_payment_id', 'CREATE INDEX ix_payment_attempts_payment_id ON payment.payment_attempts USING btree (payment_id)'),
    ('booking', 'bookings', 'ix_bookings_order_id', 'CREATE INDEX ix_bookings_order_id ON booking.bookings USING btree (order_id) WHERE (order_id IS NOT NULL)'),
    ('booking', 'bookings', 'ix_bookings_stuck_accepted', 'CREATE INDEX ix_bookings_stuck_accepted ON booking.bookings USING btree (accepted_at) WHERE ((deleted_at IS NULL) AND ((status)::text = ''accepted''::text))'),
    ('provider', 'provider_locations', 'ix_prov_loc_lat_lng', 'CREATE INDEX ix_prov_loc_lat_lng ON provider.provider_locations USING btree (latitude, longitude) WHERE ((status)::text = ''active''::text)'),
    ('provider', 'provider_services', 'ix_prov_services_provider_active', 'CREATE INDEX ix_prov_services_provider_active ON provider.provider_services USING btree (provider_id, is_active)'),
    ('provider', 'provider_service_subservices', 'ix_prov_subservices_subservice', 'CREATE INDEX ix_prov_subservices_subservice ON provider.provider_service_subservices USING btree (subservice_id, provider_service_id)')
)
SELECT 
    td.schema_name,
    td.table_name,
    td.index_name,
    CASE
      WHEN n.oid IS NULL THEN 'FAIL_MISSING_SCHEMA'
      WHEN t.oid IS NULL THEN 'FAIL_MISSING_TABLE'
      WHEN c.oid IS NULL THEN 'NOT_PRESENT'
      WHEN NOT (x.indisvalid AND x.indisready) THEN 'INVALID_INDEX'
      WHEN pg_get_indexdef(c.oid) = td.expected_def THEN 'EQUIVALENT'
      ELSE 'MISMATCH_OR_CONFLICT'
    END AS definition_status,
    x.indisvalid,
    x.indisready,
    pg_get_indexdef(c.oid) AS actual_def
FROM target_definitions td
LEFT JOIN pg_namespace n ON n.nspname = td.schema_name
LEFT JOIN pg_class t ON t.relnamespace = n.oid AND t.relname = td.table_name
LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = td.index_name
LEFT JOIN pg_index x ON x.indexrelid = c.oid AND x.indrelid = t.oid
ORDER BY td.schema_name, td.table_name, td.index_name;
```
- **Action (all rows must be classified):**
  - `FAIL_MISSING_SCHEMA` or `FAIL_MISSING_TABLE`: **HARD STOP.** The target schema or table does not exist. Do not proceed.
  - `NOT_PRESENT`: Baseline is clean for this index, it will be created.
  - `EQUIVALENT`: Index exists with exact definition. Record as `PRE_EXISTING_PRESERVED`. **Will NOT be dropped during rollback.**
  - `INVALID_INDEX`: **HARD STOP.** An invalid index exists. Operator must manually inspect ownership and drop it before re-running.
  - `MISMATCH_OR_CONFLICT`: **HARD STOP.** Index exists with wrong semantics. Do not rely on `IF NOT EXISTS`. Escalate to Lead Architect.

---

### 1.3 Scoped Pre-Flight Invalid Index Cleanup (P0 Requirement)
`CREATE INDEX CONCURRENTLY IF NOT EXISTS` **silently skips** existing indexes even if they are invalid (`indisvalid = false`). Check for and resolve invalid indexes scoped **strictly to the 21 target pairs `(schema, table, index)`**:

```sql
WITH target_scope(schema_name, table_name, index_name) AS (
  VALUES
    ('booking', 'settlement_outbox', 'ix_settlement_outbox_pending'),
    ('booking', 'lead_refund_outbox', 'ix_lead_refund_outbox_pending'),
    ('booking', 'rating_outbox', 'ix_rating_outbox_pending'),
    ('provider', 'compensation_outbox', 'ix_compensation_outbox_pending'),
    ('provider', 'wallet_outbox', 'ix_wallet_outbox_pending'),
    ('payment', 'payment_event_outbox', 'ix_payment_event_outbox_pending'),
    ('booking', 'complaints', 'ix_complaints_booking_id'),
    ('booking', 'booking_previous_providers', 'ix_booking_previous_providers_booking_id'),
    ('booking', 'conversations', 'ix_conversations_booking_id'),
    ('booking', 'coupon_redemptions', 'ix_coupon_redemptions_booking_id'),
    ('provider', 'provider_locations', 'ix_provider_locations_provider_id'),
    ('provider', 'payouts', 'ix_payouts_provider_id'),
    ('provider', 'payouts', 'ix_payouts_settlement_id'),
    ('provider', 'job_requests', 'ix_job_requests_provider_id'),
    ('payment', 'customer_wallet_transactions', 'ix_customer_wallet_tx_wallet_id'),
    ('payment', 'payment_attempts', 'ix_payment_attempts_payment_id'),
    ('booking', 'bookings', 'ix_bookings_order_id'),
    ('booking', 'bookings', 'ix_bookings_stuck_accepted'),
    ('provider', 'provider_locations', 'ix_prov_loc_lat_lng'),
    ('provider', 'provider_services', 'ix_prov_services_provider_active'),
    ('provider', 'provider_service_subservices', 'ix_prov_subservices_subservice')
)
SELECT 
    ts.schema_name,
    ts.table_name,
    ts.index_name,
    x.indisvalid,
    x.indisready
FROM target_scope ts
JOIN pg_namespace n ON n.nspname = ts.schema_name
JOIN pg_class t ON t.relnamespace = n.oid AND t.relname = ts.table_name
JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = ts.index_name
JOIN pg_index x ON x.indexrelid = c.oid AND x.indrelid = t.oid
WHERE NOT (x.indisvalid AND x.indisready);
```
- **Action:** If any invalid index is returned, clean it up before rollout:
  ```sql
  DROP INDEX CONCURRENTLY <schema_name>.<index_name>;
  ```

---

## 2. Staging Deployment Procedure (Transactional Path)

For staging or test environments with small datasets:
```bash
npx tsx migrations/runner.ts
```

---

## 3. Production Deployment Procedure (Automated Zero-Lock Concurrent Path)

In production, execute the dedicated automated concurrent deployment runner:

```bash
# Execute production runner with per-index tracking and state ledger
DATABASE_URL="<verified_production_connection_string>" \
npx tsx migrations/production_deploy_033.ts
```

### 3.1 State Machine & Per-Index Ledger (`production_migration_033_state.json`)
The production runner automatically manages a durable state machine:
1. **Pre-flight Check:** Captures index ownership and marks each index as `PRE_EXISTING_PRESERVED` or `CREATED_BY_DEPLOYMENT`.
2. **Individual Concurrent Build:** Builds each unbuilt index one-by-one outside transaction blocks.
3. **Immediate Validation:** Immediately queries `pg_index` to confirm `indisvalid = true` before proceeding to the next index.
4. **Safe Deduplication:** Confirms `uq_providers_kit_collection_id` exists before dropping redundant index `provider.idx_providers_kit_collection_id`.
5. **Fail-Closed Verification:** Runs the 21-index verification query (must return exactly 21 `PASS` rows).
6. **Finalized Registration:** Replaces the `IN_PROGRESS` lockout record in `migration.schema_migrations` with the real SHA-256 checksum only when all gates pass. Verifies the UPDATE persisted.

> [!WARNING]
> **Standard Runner Lockout:** The production runner inserts an `IN_PROGRESS` record into
> `migration.schema_migrations` at startup. This prevents `runner.ts` from attempting
> the transactional `033_performance_indexes.sql` against a partially-deployed schema.
> The lockout is replaced with the real checksum only upon full verification success.

---

## 4. Post-Creation Fail-Closed Verification (P0 Check)

```sql
WITH target_expected(schema_name, table_name, index_name, expected_def) AS (
  VALUES
    ('booking', 'settlement_outbox', 'ix_settlement_outbox_pending', 'CREATE INDEX ix_settlement_outbox_pending ON booking.settlement_outbox USING btree (created_at) WHERE ((status)::text = ''PENDING''::text)'),
    ('booking', 'lead_refund_outbox', 'ix_lead_refund_outbox_pending', 'CREATE INDEX ix_lead_refund_outbox_pending ON booking.lead_refund_outbox USING btree (created_at) WHERE ((status)::text = ''PENDING''::text)'),
    ('booking', 'rating_outbox', 'ix_rating_outbox_pending', 'CREATE INDEX ix_rating_outbox_pending ON booking.rating_outbox USING btree (created_at) WHERE ((status)::text = ''PENDING''::text)'),
    ('provider', 'compensation_outbox', 'ix_compensation_outbox_pending', 'CREATE INDEX ix_compensation_outbox_pending ON provider.compensation_outbox USING btree (created_at) WHERE ((status)::text = ANY ((ARRAY[''PENDING''::character varying, ''PROCESSING''::character varying])::text[]))'),
    ('provider', 'wallet_outbox', 'ix_wallet_outbox_pending', 'CREATE INDEX ix_wallet_outbox_pending ON provider.wallet_outbox USING btree (created_at) WHERE ((status)::text = ''PENDING''::text)'),
    ('payment', 'payment_event_outbox', 'ix_payment_event_outbox_pending', 'CREATE INDEX ix_payment_event_outbox_pending ON payment.payment_event_outbox USING btree (created_at) WHERE ((status)::text = ''PENDING''::text)'),
    ('booking', 'complaints', 'ix_complaints_booking_id', 'CREATE INDEX ix_complaints_booking_id ON booking.complaints USING btree (booking_id)'),
    ('booking', 'booking_previous_providers', 'ix_booking_previous_providers_booking_id', 'CREATE INDEX ix_booking_previous_providers_booking_id ON booking.booking_previous_providers USING btree (booking_id)'),
    ('booking', 'conversations', 'ix_conversations_booking_id', 'CREATE INDEX ix_conversations_booking_id ON booking.conversations USING btree (booking_id)'),
    ('booking', 'coupon_redemptions', 'ix_coupon_redemptions_booking_id', 'CREATE INDEX ix_coupon_redemptions_booking_id ON booking.coupon_redemptions USING btree (booking_id)'),
    ('provider', 'provider_locations', 'ix_provider_locations_provider_id', 'CREATE INDEX ix_provider_locations_provider_id ON provider.provider_locations USING btree (provider_id)'),
    ('provider', 'payouts', 'ix_payouts_provider_id', 'CREATE INDEX ix_payouts_provider_id ON provider.payouts USING btree (provider_id)'),
    ('provider', 'payouts', 'ix_payouts_settlement_id', 'CREATE INDEX ix_payouts_settlement_id ON provider.payouts USING btree (settlement_id)'),
    ('provider', 'job_requests', 'ix_job_requests_provider_id', 'CREATE INDEX ix_job_requests_provider_id ON provider.job_requests USING btree (provider_id)'),
    ('payment', 'customer_wallet_transactions', 'ix_customer_wallet_tx_wallet_id', 'CREATE INDEX ix_customer_wallet_tx_wallet_id ON payment.customer_wallet_transactions USING btree (wallet_id)'),
    ('payment', 'payment_attempts', 'ix_payment_attempts_payment_id', 'CREATE INDEX ix_payment_attempts_payment_id ON payment.payment_attempts USING btree (payment_id)'),
    ('booking', 'bookings', 'ix_bookings_order_id', 'CREATE INDEX ix_bookings_order_id ON booking.bookings USING btree (order_id) WHERE (order_id IS NOT NULL)'),
    ('booking', 'bookings', 'ix_bookings_stuck_accepted', 'CREATE INDEX ix_bookings_stuck_accepted ON booking.bookings USING btree (accepted_at) WHERE ((deleted_at IS NULL) AND ((status)::text = ''accepted''::text))'),
    ('provider', 'provider_locations', 'ix_prov_loc_lat_lng', 'CREATE INDEX ix_prov_loc_lat_lng ON provider.provider_locations USING btree (latitude, longitude) WHERE ((status)::text = ''active''::text)'),
    ('provider', 'provider_services', 'ix_prov_services_provider_active', 'CREATE INDEX ix_prov_services_provider_active ON provider.provider_services USING btree (provider_id, is_active)'),
    ('provider', 'provider_service_subservices', 'ix_prov_subservices_subservice', 'CREATE INDEX ix_prov_subservices_subservice ON provider.provider_service_subservices USING btree (subservice_id, provider_service_id)')
)
SELECT 
    te.schema_name, 
    te.table_name,
    te.index_name,
    COALESCE(x.indisvalid, false) AS indisvalid,
    COALESCE(x.indisready, false) AS indisready,
    COALESCE(am.amname, 'none') AS access_method,
    CASE
      WHEN c.oid IS NULL THEN 'FAIL_MISSING_INDEX'
      WHEN NOT (x.indisvalid AND x.indisready) THEN 'FAIL_INVALID_OR_NOT_READY'
      WHEN x.indisunique != false THEN 'FAIL_UNEXPECTED_UNIQUE'
      WHEN am.amname != 'btree' THEN 'FAIL_UNEXPECTED_AM'
      WHEN pg_get_indexdef(c.oid) != te.expected_def THEN 'FAIL_DEFINITION_MISMATCH'
      ELSE 'PASS'
    END AS verification_status
FROM target_expected te
LEFT JOIN pg_namespace n ON n.nspname = te.schema_name
LEFT JOIN pg_class t ON t.relnamespace = n.oid AND t.relname = te.table_name
LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = te.index_name
LEFT JOIN pg_index x ON x.indexrelid = c.oid AND x.indrelid = t.oid
LEFT JOIN pg_am am ON am.oid = c.relam
ORDER BY te.schema_name, te.table_name, te.index_name;
```

> [!CRITICAL]
> **Fail-Closed Threshold Check:**  
> Verify that exactly 21 rows are returned and every row reports `PASS`:
> ```sql
> WITH check_result AS (
>   -- (Above query)
> )
> SELECT count(*) AS pass_count 
> FROM check_result 
> WHERE verification_status = 'PASS';
> ```
> If `pass_count` is not exactly 21, **DO NOT register migration 033**. Halt and inspect failing rows.

---

## 5. Performance Evidence: Coordinate B-Tree Index (`ix_prov_loc_lat_lng`)

Investigation of bounding-box spatial candidate selection on `provider.provider_locations`:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM provider.provider_locations 
WHERE status = 'active' 
  AND latitude BETWEEN 12.9000 AND 13.1000 
  AND longitude BETWEEN 77.5000 AND 77.7000;
```
**Staging Evidence Captured:**
- **Execution Strategy:** `Index Scan using ix_prov_loc_lat_lng on provider_locations`
- **Execution Time:** **0.339 ms** (vs 12.4 ms sequential scan)
- **Buffer I/O:** `Buffers: shared hit=11`
- **Conclusion:** B-tree composite indexing on `(latitude, longitude) WHERE status = 'active'` accelerates rectangular bounding-box searches by over 36x without requiring PostGIS extensions.

---

## 6. Coordinated Production Rollback Procedure

If a rollback is declared, execute the automated concurrent rollback runner:

```bash
DATABASE_URL="<verified_production_connection_string>" \
npx tsx migrations/production_rollback_033.ts
```

> [!CAUTION]
> The static SQL file `BHARATCLAP_PHASE1_CORRECTED_ROLLBACK.sql` is a **reference template only**.
> It drops all 21 indexes unconditionally. Production rollback MUST use the automated runner
> which reads the state ledger and preserves pre-existing indexes.

### Safety Guarantees During Rollback:
1. **Reads Ledger:** Inspects `production_migration_033_state.json`. Refuses to operate without it.
2. **Protects Pre-Existing Indexes:** Skips any index marked `PRE_EXISTING_PRESERVED`.
3. **Drops Created Indexes Concurrently:** Executes `DROP INDEX CONCURRENTLY IF EXISTS` statement-by-statement outside transactions.
4. **Post-Drop Catalog Verification:** After each drop, verifies the index is absent from `pg_class`. If any drop fails silently, halts and preserves the migration record.
5. **Restores Deduplication Concurrently:** Restores `idx_providers_kit_collection_id` concurrently with its original definition and validates `indisvalid` and `indisready` in catalog.
6. **Tracking Deletion After Verification:** Deletes `033_performance_indexes.sql` from `migration.schema_migrations` **only after ALL** rollback operations are verified. If any verification fails, the migration record is preserved to prevent the standard runner from re-executing 033.
