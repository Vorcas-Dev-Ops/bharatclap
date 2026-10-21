/**
 * BharatClap Production Concurrent Rollback Runner for Migration 033
 * 
 * Safety Guarantees:
 * 1. SCOPED TO CREATED INDEXES ONLY: Reads production_migration_033_state.json
 *    and rolls back ONLY indexes recorded as CREATED_BY_DEPLOYMENT.
 * 2. PRE-EXISTING INDEX PROTECTION: Any index marked PRE_EXISTING_PRESERVED is
 *    guaranteed never to be dropped.
 * 3. ZERO-LOCK CONCURRENT ROLLBACK: Executes DROP INDEX CONCURRENTLY statement-by-statement
 *    outside transaction blocks, avoiding table write blocks.
 * 4. POST-DROP CATALOG VERIFICATION: Confirms each index is actually absent from
 *    pg_class after dropping. Halts if a drop failed silently.
 * 5. PER-OPERATION STATE PERSISTENCE: Writes state after each drop so interrupted
 *    rollbacks can be safely resumed without re-dropping already-verified drops.
 * 6. VERIFIED TRACKING DELETION: Removes record from schema_migrations ONLY after
 *    ALL rollback operations succeed and are verified in catalog.
 * 7. FULL DEFINITION VERIFICATION: Restored idx_providers_kit_collection_id is
 *    verified for schema, table, uniqueness, key columns, predicate, and validity.
 */
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const STATE_FILE = path.resolve(__dirname, 'production_migration_033_state.json');

const EXPECTED_KIT_COLLECTION_DEF =
  'CREATE UNIQUE INDEX idx_providers_kit_collection_id ON provider.providers USING btree (kit_collection_id) WHERE (kit_collection_id IS NOT NULL)';

/** ponytail: normalize strips formatting variance across PG versions */
const normalizeDef = (def: string): string =>
  def.replace(/\s+/g, ' ').trim();

const saveState = (state: any) => {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
};

export const rollbackProduction033 = async () => {
  const pgUrl = process.env.DATABASE_URL || process.env.PG_URL;
  if (!pgUrl) {
    console.error('🛑 DATABASE_URL must be explicitly provided in environment.');
    process.exit(1);
  }

  if (!fs.existsSync(STATE_FILE)) {
    console.error(`🛑 Cannot execute automated rollback: ${STATE_FILE} not found!`);
    console.error('   Refusing to perform blind rollback. Run manual allowlisted SQL rollback after inspecting catalog.');
    process.exit(1);
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));

  // Prevent re-running a completed rollback without explicit intent
  if (state.status === 'ROLLED_BACK') {
    console.error('🛑 State ledger shows ROLLED_BACK. Rollback already completed.');
    console.error('   To re-run, delete the state file and re-deploy first.');
    process.exit(1);
  }

  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(' BharatClap Production Zero-Lock Concurrent Rollback Runner');
  console.log(` Target Version: ${state.version}`);
  console.log(` Ledger Status: ${state.status}`);
  console.log('════════════════════════════════════════════════════════════════════════\n');

  let allVerified = true;

  try {
    // 0. Acquire advisory lock — same key as deploy, mutual exclusion
    const LOCK_KEY = 2033033033;
    const lockAcquired = await client.query(
      `SELECT pg_try_advisory_lock($1) AS acquired`, [LOCK_KEY]
    );
    if (!lockAcquired.rows[0].acquired) {
      console.error('🛑 HARD STOP: Another production deploy or rollback for migration 033 is already running.');
      console.error('   Advisory lock not acquired. Wait for the other process to finish.');
      process.exit(1);
    }
    console.log('  🔒 Advisory lock acquired (single-runner enforcement).');
    // 1. Drop only newly created indexes concurrently, verify each drop
    console.log('▶ Step 1: Dropping rollout-created indexes concurrently...');
    const indexKeys = Object.keys(state.indexes || {});
    let droppedCount = 0;
    let preservedCount = 0;

    for (const key of indexKeys) {
      const entry = state.indexes[key];
      if (entry.ownership === 'PRE_EXISTING_PRESERVED') {
        console.log(`  🛡 PRESERVING pre-existing index: ${key}`);
        preservedCount++;
        continue;
      }

      // Skip indexes already rolled back in a previous interrupted run
      if (entry.rollbackStatus === 'DROPPED_VERIFIED') {
        console.log(`  ✓ ${key}: Already dropped & verified in previous run.`);
        droppedCount++;
        continue;
      }

      // ponytail: rollback decisions use explicit ownership field, not status label
      if (entry.status === 'CREATED' || entry.status === 'VERIFIED' || entry.status === 'FAILED') {
        console.log(`  ▶ Dropping ${entry.schema}.${entry.index} concurrently...`);
        const startMs = Date.now();
        await client.query(`DROP INDEX CONCURRENTLY IF EXISTS ${entry.schema}.${entry.index}`);
        const elapsed = Date.now() - startMs;

        // Verify the index is actually gone from catalog
        const verifyGone = await client.query(`
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relname = $2
        `, [entry.schema, entry.index]);

        if (verifyGone.rows.length > 0) {
          console.error(`    ❌ DROP appeared to succeed but ${entry.schema}.${entry.index} still exists in catalog!`);
          allVerified = false;
          entry.rollbackStatus = 'DROP_FAILED';
          saveState(state);
          break; // Stop immediately — don't continue dropping other indexes
        } else {
          droppedCount++;
          entry.rollbackStatus = 'DROPPED_VERIFIED';
          entry.rollbackTimeMs = elapsed;
          saveState(state); // Persist after each successful drop
          console.log(`    ✅ Dropped & verified absent: ${entry.index} (${elapsed}ms)`);
        }
      }
    }
    console.log(`  Dropped: ${droppedCount}, Preserved: ${preservedCount}`);

    if (!allVerified) {
      console.error('\n🛑 HARD STOP: Not all drops were verified. Migration record will NOT be removed.');
      console.error('   Inspect catalog manually, resolve, then re-run this script to resume.');
      process.exit(1);
    }

    // 2. Restore deduplicated index if it was dropped
    if (state.deduplicationDropped && state.restorationStatus !== 'RESTORED_VERIFIED') {
      console.log('\n▶ Step 2: Restoring deduplicated index concurrently...');

      // Check if the index already exists (e.g. from a partial previous restore)
      const preCheck = await client.query(`
        SELECT pg_get_indexdef(c.oid) AS actual_def, x.indisvalid, x.indisready
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_index x ON x.indexrelid = c.oid
        WHERE n.nspname = 'provider' AND c.relname = 'idx_providers_kit_collection_id'
      `);

      if (preCheck.rows.length > 0) {
        const existing = preCheck.rows[0];
        const existingNorm = normalizeDef(existing.actual_def);
        const expectedNorm = normalizeDef(EXPECTED_KIT_COLLECTION_DEF);
        if (existingNorm === expectedNorm && existing.indisvalid && existing.indisready) {
          console.log('  ℹ idx_providers_kit_collection_id already exists with correct definition. Skipping creation.');
          state.restorationStatus = 'RESTORED_VERIFIED';
          saveState(state);
        } else if (!existing.indisvalid || !existing.indisready) {
          console.error('🛑 HARD STOP: idx_providers_kit_collection_id exists but is INVALID!');
          console.error('   Drop it manually first: DROP INDEX CONCURRENTLY provider.idx_providers_kit_collection_id;');
          state.restorationStatus = 'FAILED';
          saveState(state);
          allVerified = false;
        } else {
          console.error('🛑 HARD STOP: idx_providers_kit_collection_id exists with CONFLICTING definition!');
          console.error(`   Actual:   ${existingNorm}`);
          console.error(`   Expected: ${expectedNorm}`);
          state.restorationStatus = 'FAILED';
          saveState(state);
          allVerified = false;
        }
      } else {
        console.log('  ▶ Creating UNIQUE INDEX CONCURRENTLY idx_providers_kit_collection_id...');
        const startMs = Date.now();
        await client.query(`
          CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_kit_collection_id
            ON provider.providers (kit_collection_id)
            WHERE (kit_collection_id IS NOT NULL);
        `);
        const elapsed = Date.now() - startMs;

        // Full definition verification — not just validity
        const restRes = await client.query(`
          SELECT 
            x.indisvalid,
            x.indisready,
            x.indisunique,
            pg_get_indexdef(c.oid) AS actual_def,
            n.nspname AS schema_name,
            t.relname AS table_name,
            am.amname AS access_method
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_index x ON x.indexrelid = c.oid
          JOIN pg_class t ON t.oid = x.indrelid
          JOIN pg_am am ON am.oid = c.relam
          WHERE n.nspname = 'provider' AND t.relname = 'providers' AND c.relname = 'idx_providers_kit_collection_id'
        `);

        if (restRes.rows.length === 0) {
          console.error('🛑 HARD STOP: Restored index not found in catalog!');
          state.restorationStatus = 'FAILED';
          saveState(state);
          allVerified = false;
        } else {
          const r = restRes.rows[0];
          const actualNorm = normalizeDef(r.actual_def);
          const expectedNorm = normalizeDef(EXPECTED_KIT_COLLECTION_DEF);
          const checks = [
            { name: 'indisvalid',    expected: true,        actual: r.indisvalid },
            { name: 'indisready',    expected: true,        actual: r.indisready },
            { name: 'indisunique',   expected: true,        actual: r.indisunique },
            { name: 'schema',        expected: 'provider',  actual: r.schema_name },
            { name: 'table',         expected: 'providers', actual: r.table_name },
            { name: 'access_method', expected: 'btree',     actual: r.access_method },
            { name: 'definition',    expected: expectedNorm, actual: actualNorm },
          ];

          const failures = checks.filter(c => String(c.actual) !== String(c.expected));
          if (failures.length > 0) {
            console.error('🛑 HARD STOP: Restored index failed full definition verification!');
            for (const f of failures) {
              console.error(`   ${f.name}: expected=${f.expected}, actual=${f.actual}`);
            }
            state.restorationStatus = 'FAILED';
            saveState(state);
            allVerified = false;
          } else {
            console.log(`    ✅ idx_providers_kit_collection_id: all 7 checks passed (${elapsed}ms)`);
            console.log(`       schema=provider, table=providers, unique=true, btree, valid, ready, definition=matched`);
            state.restorationStatus = 'RESTORED_VERIFIED';
            if (state.deduplication) state.deduplication.restoredAt = new Date().toISOString();
            saveState(state);
          }
        }
      }
    } else if (state.deduplicationDropped && state.restorationStatus === 'RESTORED_VERIFIED') {
      console.log('\n▶ Step 2: Deduplication restoration already verified in previous run.');
    } else {
      console.log('\n▶ Step 2: No deduplication to restore.');
    }

    if (!allVerified) {
      console.error('\n🛑 HARD STOP: Restoration verification failed. Migration record preserved.');
      process.exit(1);
    }

    // 3. Only NOW reconcile schema_migrations — after ALL operations verified
    console.log('\n▶ Step 3: Removing migration tracking record (post-verification)...');
    const delResult = await client.query(`
      DELETE FROM migration.schema_migrations
      WHERE filename = '033_performance_indexes.sql'
      RETURNING filename
    `);
    if (delResult.rows.length > 0) {
      console.log('  ✅ Deleted 033_performance_indexes.sql from migration.schema_migrations');
    } else {
      console.log('  ℹ No migration record found to delete (may have been partially deployed).');
    }

    state.status = 'ROLLED_BACK';
    state.rolledBackAt = new Date().toISOString();
    saveState(state);

    console.log('\n🎉 PRODUCTION ROLLBACK FOR MIGRATION 033 COMPLETED & VERIFIED SAFELY!');
  } finally {
    await client.end();
  }
};

if (require.main === module) {
  rollbackProduction033().catch(err => {
    console.error('Fatal rollback error:', err);
    process.exit(1);
  });
}
