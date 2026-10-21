/**
 * BharatClap Production Concurrent Deployment Runner for Migration 033
 * 
 * Safety Guarantees:
 * 1. ZERO TRANSACTION WRAPPERS: Runs all CREATE INDEX CONCURRENTLY statements
 *    individually in autocommit mode outside transaction blocks.
 * 2. PRE-DEPLOYMENT INVENTORY & OWNERSHIP TRACKING: Inspects catalog before DDL.
 *    Any pre-existing equivalent index is marked PRE_EXISTING_PRESERVED and will
 *    NEVER be dropped during rollback.
 * 3. FAIL-CLOSED CONFLICT DETECTION: If any target index name exists with a conflicting
 *    definition, aborts immediately before modifying anything.
 * 4. PER-INDEX RESUMABLE STATE LEDGER: Persists state to production_migration_033_state.json
 *    after each statement. If interrupted, can resume cleanly.
 * 5. ATOMIC VALIDITY GATING: Migration 033 is registered in schema_migrations ONLY
 *    when all 21 indexes pass the fail-closed verification query.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';

interface TargetIndexSpec {
  schema: string;
  table: string;
  index: string;
  statement: string;
  expectedDef: string;
}

const TARGET_INDEXES: TargetIndexSpec[] = [
  {
    schema: 'booking',
    table: 'settlement_outbox',
    index: 'ix_settlement_outbox_pending',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_settlement_outbox_pending ON booking.settlement_outbox (created_at ASC) WHERE status = 'PENDING';`,
    expectedDef: `CREATE INDEX ix_settlement_outbox_pending ON booking.settlement_outbox USING btree (created_at) WHERE ((status)::text = 'PENDING'::text)`
  },
  {
    schema: 'booking',
    table: 'lead_refund_outbox',
    index: 'ix_lead_refund_outbox_pending',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_lead_refund_outbox_pending ON booking.lead_refund_outbox (created_at ASC) WHERE status = 'PENDING';`,
    expectedDef: `CREATE INDEX ix_lead_refund_outbox_pending ON booking.lead_refund_outbox USING btree (created_at) WHERE ((status)::text = 'PENDING'::text)`
  },
  {
    schema: 'booking',
    table: 'rating_outbox',
    index: 'ix_rating_outbox_pending',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_rating_outbox_pending ON booking.rating_outbox (created_at ASC) WHERE status = 'PENDING';`,
    expectedDef: `CREATE INDEX ix_rating_outbox_pending ON booking.rating_outbox USING btree (created_at) WHERE ((status)::text = 'PENDING'::text)`
  },
  {
    schema: 'provider',
    table: 'compensation_outbox',
    index: 'ix_compensation_outbox_pending',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_compensation_outbox_pending ON provider.compensation_outbox (created_at ASC) WHERE status IN ('PENDING', 'PROCESSING');`,
    expectedDef: `CREATE INDEX ix_compensation_outbox_pending ON provider.compensation_outbox USING btree (created_at) WHERE ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSING'::character varying])::text[]))`
  },
  {
    schema: 'provider',
    table: 'wallet_outbox',
    index: 'ix_wallet_outbox_pending',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_wallet_outbox_pending ON provider.wallet_outbox (created_at ASC) WHERE status = 'PENDING';`,
    expectedDef: `CREATE INDEX ix_wallet_outbox_pending ON provider.wallet_outbox USING btree (created_at) WHERE ((status)::text = 'PENDING'::text)`
  },
  {
    schema: 'payment',
    table: 'payment_event_outbox',
    index: 'ix_payment_event_outbox_pending',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payment_event_outbox_pending ON payment.payment_event_outbox (created_at ASC) WHERE status = 'PENDING';`,
    expectedDef: `CREATE INDEX ix_payment_event_outbox_pending ON payment.payment_event_outbox USING btree (created_at) WHERE ((status)::text = 'PENDING'::text)`
  },
  {
    schema: 'booking',
    table: 'complaints',
    index: 'ix_complaints_booking_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_complaints_booking_id ON booking.complaints (booking_id);`,
    expectedDef: `CREATE INDEX ix_complaints_booking_id ON booking.complaints USING btree (booking_id)`
  },
  {
    schema: 'booking',
    table: 'booking_previous_providers',
    index: 'ix_booking_previous_providers_booking_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_booking_previous_providers_booking_id ON booking.booking_previous_providers (booking_id);`,
    expectedDef: `CREATE INDEX ix_booking_previous_providers_booking_id ON booking.booking_previous_providers USING btree (booking_id)`
  },
  {
    schema: 'booking',
    table: 'conversations',
    index: 'ix_conversations_booking_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_conversations_booking_id ON booking.conversations (booking_id);`,
    expectedDef: `CREATE INDEX ix_conversations_booking_id ON booking.conversations USING btree (booking_id)`
  },
  {
    schema: 'booking',
    table: 'coupon_redemptions',
    index: 'ix_coupon_redemptions_booking_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_coupon_redemptions_booking_id ON booking.coupon_redemptions (booking_id);`,
    expectedDef: `CREATE INDEX ix_coupon_redemptions_booking_id ON booking.coupon_redemptions USING btree (booking_id)`
  },
  {
    schema: 'provider',
    table: 'provider_locations',
    index: 'ix_provider_locations_provider_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_provider_locations_provider_id ON provider.provider_locations (provider_id);`,
    expectedDef: `CREATE INDEX ix_provider_locations_provider_id ON provider.provider_locations USING btree (provider_id)`
  },
  {
    schema: 'provider',
    table: 'payouts',
    index: 'ix_payouts_provider_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payouts_provider_id ON provider.payouts (provider_id);`,
    expectedDef: `CREATE INDEX ix_payouts_provider_id ON provider.payouts USING btree (provider_id)`
  },
  {
    schema: 'provider',
    table: 'payouts',
    index: 'ix_payouts_settlement_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payouts_settlement_id ON provider.payouts (settlement_id);`,
    expectedDef: `CREATE INDEX ix_payouts_settlement_id ON provider.payouts USING btree (settlement_id)`
  },
  {
    schema: 'provider',
    table: 'job_requests',
    index: 'ix_job_requests_provider_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_job_requests_provider_id ON provider.job_requests (provider_id);`,
    expectedDef: `CREATE INDEX ix_job_requests_provider_id ON provider.job_requests USING btree (provider_id)`
  },
  {
    schema: 'payment',
    table: 'customer_wallet_transactions',
    index: 'ix_customer_wallet_tx_wallet_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_customer_wallet_tx_wallet_id ON payment.customer_wallet_transactions (wallet_id);`,
    expectedDef: `CREATE INDEX ix_customer_wallet_tx_wallet_id ON payment.customer_wallet_transactions USING btree (wallet_id)`
  },
  {
    schema: 'payment',
    table: 'payment_attempts',
    index: 'ix_payment_attempts_payment_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payment_attempts_payment_id ON payment.payment_attempts (payment_id);`,
    expectedDef: `CREATE INDEX ix_payment_attempts_payment_id ON payment.payment_attempts USING btree (payment_id)`
  },
  {
    schema: 'booking',
    table: 'bookings',
    index: 'ix_bookings_order_id',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bookings_order_id ON booking.bookings (order_id) WHERE order_id IS NOT NULL;`,
    expectedDef: `CREATE INDEX ix_bookings_order_id ON booking.bookings USING btree (order_id) WHERE (order_id IS NOT NULL)`
  },
  {
    schema: 'booking',
    table: 'bookings',
    index: 'ix_bookings_stuck_accepted',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bookings_stuck_accepted ON booking.bookings (accepted_at ASC) WHERE deleted_at IS NULL AND status = 'accepted';`,
    expectedDef: `CREATE INDEX ix_bookings_stuck_accepted ON booking.bookings USING btree (accepted_at) WHERE ((deleted_at IS NULL) AND ((status)::text = 'accepted'::text))`
  },
  {
    schema: 'provider',
    table: 'provider_locations',
    index: 'ix_prov_loc_lat_lng',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_prov_loc_lat_lng ON provider.provider_locations (latitude, longitude) WHERE status = 'active';`,
    expectedDef: `CREATE INDEX ix_prov_loc_lat_lng ON provider.provider_locations USING btree (latitude, longitude) WHERE ((status)::text = 'active'::text)`
  },
  {
    schema: 'provider',
    table: 'provider_services',
    index: 'ix_prov_services_provider_active',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_prov_services_provider_active ON provider.provider_services (provider_id, is_active);`,
    expectedDef: `CREATE INDEX ix_prov_services_provider_active ON provider.provider_services USING btree (provider_id, is_active)`
  },
  {
    schema: 'provider',
    table: 'provider_service_subservices',
    index: 'ix_prov_subservices_subservice',
    statement: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_prov_subservices_subservice ON provider.provider_service_subservices (subservice_id, provider_service_id);`,
    expectedDef: `CREATE INDEX ix_prov_subservices_subservice ON provider.provider_service_subservices USING btree (subservice_id, provider_service_id)`
  }
];

const STATE_FILE = path.resolve(__dirname, 'production_migration_033_state.json');

interface DeploymentState {
  version: string;
  startedAt: string;
  completedAt?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  checksum: string;
  indexes: {
    [key: string]: {
      schema: string;
      table: string;
      index: string;
      ownership: 'PRE_EXISTING_PRESERVED' | 'CREATED_BY_DEPLOYMENT';
      status: 'PENDING' | 'CREATED' | 'VERIFIED' | 'FAILED';
      executionTimeMs?: number;
      error?: string;
    };
  };
  deduplicationDropped: boolean;
  deduplication?: {
    indexName: string;
    schema: string;
    table: string;
    originalDef?: string;
    droppedAt?: string;
    restoredAt?: string;
  };
}

/** ponytail: normalize strips formatting variance across PG versions without semantic diff */
const normalizeDef = (def: string): string =>
  def.replace(/\s+/g, ' ').trim();

const saveState = (state: DeploymentState) => {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
};

const loadState = (): DeploymentState | null => {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  return null;
};

export const deployProduction033 = async () => {
  const pgUrl = process.env.DATABASE_URL || process.env.PG_URL;
  if (!pgUrl) {
    console.error('🛑 DATABASE_URL must be explicitly provided in environment.');
    process.exit(1);
  }

  const migrationFilePath = path.resolve(__dirname, '033_performance_indexes.sql');
  const migrationContent = fs.readFileSync(migrationFilePath, 'utf-8');
  const expectedChecksum = crypto.createHash('sha256').update(migrationContent).digest('hex');

  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(' BharatClap Production Zero-Lock Concurrent Migration Runner');
  console.log(` Target File: 033_performance_indexes.sql (SHA-256: ${expectedChecksum.substring(0, 16)}...)`);
  console.log('════════════════════════════════════════════════════════════════════════\n');

  try {
    // 0. Acquire advisory lock — mutual exclusion against concurrent deploy/rollback
    const LOCK_KEY = 2033033033; // deterministic key for migration 033
    const lockAcquired = await client.query(
      `SELECT pg_try_advisory_lock($1) AS acquired`, [LOCK_KEY]
    );
    if (!lockAcquired.rows[0].acquired) {
      console.error('🛑 HARD STOP: Another production deploy or rollback for migration 033 is already running.');
      console.error('   Advisory lock not acquired. Wait for the other process to finish or verify it is not stuck.');
      process.exit(1);
    }
    console.log('  🔒 Advisory lock acquired (single-runner enforcement).');
    // 1. Ensure tracking schema and table exist
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS migration;
      CREATE TABLE IF NOT EXISTS migration.schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        checksum VARCHAR(128) NOT NULL,
        execution_time_ms BIGINT NOT NULL DEFAULT 0,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Check for conflicting previous application
    const existingMig = await client.query(
      `SELECT checksum, applied_at FROM migration.schema_migrations WHERE filename = '033_performance_indexes.sql'`
    );

    if (existingMig.rows.length > 0) {
      const recorded = existingMig.rows[0].checksum;
      const isOwnLockout = recorded === `IN_PROGRESS:${expectedChecksum}`;
      const isCompleted = recorded === expectedChecksum;
      if (isOwnLockout) {
        console.log('  ℹ Found IN_PROGRESS lockout record from previous run. Resuming deployment...');
      } else if (isCompleted) {
        // Already fully deployed — will be caught by verification
      } else {
        console.error(`🛑 HARD STOP: migration.schema_migrations contains a CONFLICTING checksum for 033_performance_indexes.sql!`);
        console.error(`   Recorded: ${recorded}`);
        console.error(`   Expected: ${expectedChecksum}`);
        console.error(`   Manual DBA review required. Never overwrite recorded checksums.`);
        process.exit(1);
      }
    }

    // 3. Initialize or resume state ledger
    let state = loadState();
    if (state) {
      // Validate state ledger matches current migration file
      if (state.checksum !== expectedChecksum) {
        console.error(`🛑 HARD STOP: State ledger checksum mismatch!`);
        console.error(`   Ledger recorded: ${state.checksum}`);
        console.error(`   Current file:    ${expectedChecksum}`);
        console.error(`   The migration file has changed since the last run.`);
        console.error(`   Delete ${STATE_FILE} and re-run only after confirming intent.`);
        process.exit(1);
      }
    } else {
      state = {
        version: '033_performance_indexes.sql',
        startedAt: new Date().toISOString(),
        status: 'IN_PROGRESS',
        checksum: expectedChecksum,
        indexes: {},
        deduplicationDropped: false
      };
    }

    // 3a. Lock out standard runner from executing 033 transactionally
    // Insert an IN_PROGRESS record so runner.ts sees it as "already applied"
    // and won't attempt the transactional BEGIN/COMMIT path.
    const lockRes = await client.query(
      `SELECT checksum FROM migration.schema_migrations WHERE filename = '033_performance_indexes.sql'`
    );
    if (lockRes.rows.length === 0) {
      await client.query(
        `INSERT INTO migration.schema_migrations (filename, checksum, execution_time_ms)
         VALUES ($1, $2, -1)`,
        ['033_performance_indexes.sql', `IN_PROGRESS:${expectedChecksum}`]
      );
      console.log('  🔒 Standard runner lockout record inserted (checksum=IN_PROGRESS:...).');
    }

    // 4. Pre-Deployment Inventory & Conflict Check
    console.log('▶ Step 1: Pre-Deployment Index Inventory & Definition Equivalence Check...');

    // 4a. Verify every target schema and table exists (fail-closed on missing)
    const schemaTablePairs = [...new Set(TARGET_INDEXES.map(t => `${t.schema}|${t.table}`))];
    for (const pair of schemaTablePairs) {
      const [schema, table] = pair.split('|');
      const schemaExists = await client.query(
        `SELECT 1 FROM pg_namespace WHERE nspname = $1`, [schema]
      );
      if (schemaExists.rows.length === 0) {
        console.error(`🛑 HARD STOP: Schema '${schema}' does not exist in this database!`);
        state.status = 'FAILED';
        saveState(state);
        process.exit(1);
      }
      const tableExists = await client.query(
        `SELECT 1 FROM pg_class t
         JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = $1 AND t.relname = $2 AND t.relkind IN ('r', 'p')`,
        [schema, table]
      );
      if (tableExists.rows.length === 0) {
        console.error(`🛑 HARD STOP: Table '${schema}.${table}' does not exist!`);
        state.status = 'FAILED';
        saveState(state);
        process.exit(1);
      }
    }

    for (const target of TARGET_INDEXES) {
      const key = `${target.schema}.${target.index}`;
      if (!state.indexes[key]) {
        // Structured catalog comparison: check all relevant properties individually
        const catRes = await client.query(`
          SELECT 
            c.oid,
            x.indisvalid,
            x.indisready,
            x.indisunique,
            am.amname,
            pg_get_indexdef(c.oid) AS actual_def,
            x.indkey::text AS key_cols,
            pg_get_expr(x.indpred, x.indrelid) AS predicate
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_index x ON x.indexrelid = c.oid
          JOIN pg_class t ON t.oid = x.indrelid
          JOIN pg_am am ON am.oid = c.relam
          WHERE n.nspname = $1 AND t.relname = $2 AND c.relname = $3
        `, [target.schema, target.table, target.index]);

        if (catRes.rows.length > 0) {
          const row = catRes.rows[0];

          // Gate 1: validity
          if (!row.indisvalid || !row.indisready) {
            console.error(`🛑 HARD STOP: Index ${key} exists but is invalid/not-ready!`);
            console.error(`   indisvalid=${row.indisvalid}, indisready=${row.indisready}`);
            console.error(`   Drop the invalid index manually after confirming ownership:`);
            console.error(`   DROP INDEX CONCURRENTLY ${target.schema}.${target.index};`);
            state.status = 'FAILED';
            saveState(state);
            process.exit(1);
          }

          // Gate 2: structured property comparison
          const structuralChecks = [
            { prop: 'indisunique', expected: false, actual: row.indisunique },
            { prop: 'amname',     expected: 'btree', actual: row.amname },
          ];
          const structuralFailures = structuralChecks.filter(c => String(c.actual) !== String(c.expected));

          // Gate 3: normalized full definition (covers key columns, expressions, predicates, sort order)
          const actualNorm = normalizeDef(row.actual_def);
          const expectedNorm = normalizeDef(target.expectedDef);
          const defMatch = actualNorm === expectedNorm;

          if (structuralFailures.length === 0 && defMatch) {
            console.log(`  ℹ ${key} exists with equivalent definition (structural + textual match). Marking PRE_EXISTING_PRESERVED.`);
            state.indexes[key] = {
              schema: target.schema,
              table: target.table,
              index: target.index,
              ownership: 'PRE_EXISTING_PRESERVED',
              status: 'VERIFIED'
            };
          } else {
            console.error(`🛑 HARD STOP: Index ${key} exists with conflicting properties!`);
            if (structuralFailures.length > 0) {
              for (const f of structuralFailures) {
                console.error(`   ${f.prop}: expected=${f.expected}, actual=${f.actual}`);
              }
            }
            if (!defMatch) {
              console.error(`   Definition mismatch:`);
              console.error(`   Actual (normalized):   ${actualNorm}`);
              console.error(`   Expected (normalized): ${expectedNorm}`);
            }
            state.status = 'FAILED';
            saveState(state);
            process.exit(1);
          }
        } else {
          state.indexes[key] = {
            schema: target.schema,
            table: target.table,
            index: target.index,
            ownership: 'CREATED_BY_DEPLOYMENT',
            status: 'PENDING'
          };
        }
      }
    }
    saveState(state);

    // 5. Scoped Invalid Index Cleanup
    // ponytail: invalid index cleanup now handled in Step 1 as a hard stop.
    // The operator must manually confirm and drop invalid indexes before re-running.
    // This prevents the script from silently dropping indexes it doesn't own.
    console.log('\n▶ Step 2: Invalid index pre-check (handled in Step 1 as hard stop)... OK');

    // 6. Execute Concurrent Index Deployments One by One
    console.log('\n▶ Step 3: Concurrent Index Creation (Non-Transactional Autocommit)...');
    for (const target of TARGET_INDEXES) {
      const key = `${target.schema}.${target.index}`;
      const entry = state.indexes[key];

      if (entry.status === 'CREATED') {
        console.log(`  ✓ ${key} (${entry.ownership}): Already verified.`);
        continue;
      }

      console.log(`  ▶ Building ${target.index} on ${target.schema}.${target.table}...`);
      const startMs = Date.now();
      try {
        await client.query(target.statement);
        const elapsed = Date.now() - startMs;

        // Verify validity immediately
        const valRes = await client.query(`
          SELECT x.indisvalid, x.indisready
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_index x ON x.indexrelid = c.oid
          JOIN pg_class t ON t.oid = x.indrelid
          WHERE n.nspname = $1 AND t.relname = $2 AND c.relname = $3
        `, [target.schema, target.table, target.index]);

        if (valRes.rows.length === 0 || !valRes.rows[0].indisvalid || !valRes.rows[0].indisready) {
          throw new Error(`Index build completed but catalog reports invalid state (indisvalid=${valRes.rows[0]?.indisvalid})`);
        }

        entry.status = 'CREATED';
        entry.executionTimeMs = elapsed;
        saveState(state);
        console.log(`    ✅ ${target.index} built & valid (${elapsed}ms)`);
      } catch (err: any) {
        console.error(`    ❌ ${target.index} FAILED: ${err.message}`);
        entry.status = 'FAILED';
        entry.error = err.message;
        state.status = 'FAILED';
        saveState(state);
        console.error(`\n🛑 Deployment halted. Inspect lock waits or cancel state.`);
        console.error(`   To retry after resolving cause, re-run this script.`);
        process.exit(1);
      }
    }

    // 7. Redundant Deduplication
    console.log('\n▶ Step 4: Redundant Index Deduplication...');
    if (!state.deduplicationDropped) {
      // Confirm twin unique index is active before dropping duplicate
      const twinRes = await client.query(`
        SELECT x.indisvalid
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_index x ON x.indexrelid = c.oid
        WHERE n.nspname = 'provider' AND c.relname = 'uq_providers_kit_collection_id'
      `);

      if (twinRes.rows.length === 0 || !twinRes.rows[0].indisvalid) {
        console.error('🛑 ABORT DEDUPLICATION: uq_providers_kit_collection_id not found or invalid! Keeping duplicate.');
      } else {
        // Check if the duplicate actually exists before attempting to drop
        const origDefRes = await client.query(`
          SELECT pg_get_indexdef(c.oid) AS def
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'provider' AND c.relname = 'idx_providers_kit_collection_id'
        `);

        if (origDefRes.rows.length === 0) {
          // Index is already absent — do NOT mark as dropped by this deployment
          console.log('  ℹ idx_providers_kit_collection_id is already absent. Nothing to deduplicate.');
          state.deduplicationDropped = false;
          state.deduplication = {
            indexName: 'idx_providers_kit_collection_id',
            schema: 'provider',
            table: 'providers',
            originalDef: 'ALREADY_ABSENT_BEFORE_DEPLOYMENT',
            droppedAt: undefined
          };
          saveState(state);
        } else {
          const originalDef = origDefRes.rows[0].def;
          console.log(`  ℹ Captured original definition: ${originalDef}`);

          await client.query(`DROP INDEX CONCURRENTLY IF EXISTS provider.idx_providers_kit_collection_id`);
          state.deduplicationDropped = true;
          state.deduplication = {
            indexName: 'idx_providers_kit_collection_id',
            schema: 'provider',
            table: 'providers',
            originalDef: originalDef,
            droppedAt: new Date().toISOString()
          };
          saveState(state);
          console.log('  ✅ Dropped redundant provider.idx_providers_kit_collection_id concurrently.');
        }
      }
    } else {
      console.log('  ✓ Deduplication already completed.');
    }

    // 8. Fail-Closed Final Catalog Verification
    console.log('\n▶ Step 5: Fail-Closed Final Catalog Verification...');
    const verifySql = `
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
        te.schema_name, te.table_name, te.index_name,
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
    `;

    const vRes = await client.query(verifySql);
    // Also check row count: must be exactly 21 (LEFT JOIN guarantees one row per target)
    if (vRes.rows.length !== TARGET_INDEXES.length) {
      console.error(`🛑 GATING FAILED: Expected exactly ${TARGET_INDEXES.length} verification rows, got ${vRes.rows.length}!`);
      state.status = 'FAILED';
      saveState(state);
      process.exit(1);
    }
    const passes = vRes.rows.filter(r => r.verification_status === 'PASS');
    console.log(`  Validation Results: ${passes.length} / ${TARGET_INDEXES.length} PASS`);

    if (passes.length !== TARGET_INDEXES.length) {
      console.error('🛑 GATING FAILED: Not all target indexes passed verification!');
      console.error(vRes.rows.filter(r => r.verification_status !== 'PASS'));
      state.status = 'FAILED';
      saveState(state);
      process.exit(1);
    }

    // 9. Finalize registration: replace IN_PROGRESS lockout with real checksum
    console.log('\n▶ Step 6: Finalizing migration registration in migration.schema_migrations...');
    const totalMs = Object.values(state.indexes)
      .reduce((sum, e) => sum + (e.executionTimeMs || 0), 0);
    await client.query(`
      UPDATE migration.schema_migrations
      SET checksum = $2, execution_time_ms = $3, applied_at = NOW()
      WHERE filename = $1
    `, ['033_performance_indexes.sql', expectedChecksum, totalMs]);
    // Verify the update actually happened
    const regCheck = await client.query(
      `SELECT checksum FROM migration.schema_migrations WHERE filename = '033_performance_indexes.sql'`
    );
    if (regCheck.rows.length === 0 || regCheck.rows[0].checksum !== expectedChecksum) {
      console.error('🛑 GATING FAILED: Migration registration did not persist correctly!');
      state.status = 'FAILED';
      saveState(state);
      process.exit(1);
    }

    state.status = 'COMPLETED';
    state.completedAt = new Date().toISOString();
    saveState(state);

    console.log('\n🎉 PRODUCTION MIGRATION 033 DEPLOYED & VERIFIED WITH 100% SUCCESS!');
  } finally {
    await client.end();
  }
};

if (require.main === module) {
  deployProduction033().catch(err => {
    console.error('Fatal deployment error:', err);
    process.exit(1);
  });
}
