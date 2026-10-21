/**
 * Migration Runner — Versioned, checksummed, checkpoint-aware
 *
 * Usage:
 *   npx tsx migrations/runner.ts [--dry-run] [--force VERSION]
 *
 * Features:
 *   - Reads all NNN_*.sql files in migrations/ directory
 *   - Computes SHA-256 checksum of each file
 *   - Checks schema_migrations table for already-applied versions
 *   - STOPS if a previously-applied migration has a changed checksum
 *   - Applies new migrations in order
 *   - Records version, filename, checksum, execution time
 *
 * Safety:
 *   - Each migration runs in its own transaction (unless it contains explicit BEGIN/COMMIT)
 *   - Failed migration stops the runner — manual intervention required
 *   - --dry-run shows what would be applied without executing
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.resolve(__dirname);

interface MigrationFile {
  filename: string;
  filepath: string;
  checksum: string;
}

interface AppliedMigration {
  filename: string;
  checksum: string;
  applied_at: string;
}

const computeChecksum = (filepath: string): string => {
  const content = fs.readFileSync(filepath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
};

const discoverMigrations = (): MigrationFile[] => {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{3}[a-z]?_.*\.sql$/.test(f))
    .sort();

  return files.map(filename => {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    return {
      filename,
      filepath,
      checksum: computeChecksum(filepath),
    };
  });
};

const getAppliedMigrations = async (client: Client): Promise<AppliedMigration[]> => {
  // Check if schema_migrations table exists
  const exists = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'migration' AND table_name = 'schema_migrations'
  `);

  if (exists.rows.length === 0) {
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS migration;
      CREATE TABLE IF NOT EXISTS migration.schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        checksum VARCHAR(128) NOT NULL,
        execution_time_ms BIGINT NOT NULL DEFAULT 0,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    return [];
  }

  const result = await client.query(
    'SELECT filename, checksum, applied_at FROM migration.schema_migrations ORDER BY filename'
  );
  return result.rows;
};

const run = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const forceIdx = args.indexOf('--force');
  const forceVersion = forceIdx >= 0 ? parseInt(args[forceIdx + 1], 10) : null;

  const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
  if (forceVersion !== null && isProduction) {
    console.error('🛑 FATAL: --force override is strictly forbidden in production environments.');
    process.exit(1);
  }

  const pgUrl = process.env.DATABASE_URL || process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  console.log(`\n═══ BharatClap Migration Runner ═══`);
  console.log(`Database: ${pgUrl.replace(/\/\/.*:.*@/, '//<credentials>@')}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (Inventory Preview Only)' : 'LIVE'}\n`);

  try {
    const migrations = discoverMigrations();
    const applied = await getAppliedMigrations(client);
    const appliedMap = new Map(applied.map(a => [a.filename, a]));

    console.log(`Found ${migrations.length} migration files, ${applied.length} already applied.\n`);

    // Phase 1: Checksum verification
    let checksumFailed = false;
    for (const mig of migrations) {
      const prev = appliedMap.get(mig.filename);
      if (prev && prev.checksum !== mig.checksum) {
        // Detect IN_PROGRESS lockout from production concurrent runner
        if (prev.checksum.startsWith('IN_PROGRESS:')) {
          console.error(`🛑 BLOCKED: ${mig.filename} has an active production concurrent deployment in progress.`);
          console.error(`   Lockout record: ${prev.checksum}`);
          console.error(`   Use migrations/production_deploy_033.ts to resume or complete the deployment.`);
          console.error(`   Do NOT run the standard runner against a partially-deployed concurrent migration.`);
          checksumFailed = true;
          continue;
        }

        console.error(`❌ CHECKSUM MISMATCH: ${mig.filename}`);
        console.error(`   Applied:  ${prev.checksum}`);
        console.error(`   Current:  ${mig.checksum}`);
        console.error(`   Applied at: ${prev.applied_at}`);

        if (forceVersion !== null && !isProduction && mig.filename.startsWith(String(forceVersion).padStart(3,'0'))) {
          console.warn(`   ⚠️  --force specified in non-production. Continuing despite mismatch.`);
        } else {
          checksumFailed = true;
        }
      }
    }

    if (checksumFailed) {
      console.error(`\n🛑 Migration aborted: checksum mismatch detected.`);
      console.error(`   Fix the migration file or use --force VERSION to override.`);
      process.exit(1);
    }

    // Phase 2: Apply pending migrations
    const pending = migrations.filter(m => !appliedMap.has(m.filename));

    if (pending.length === 0) {
      console.log('✅ All migrations are up to date. Nothing to apply.');
      return;
    }

    console.log(`Pending migrations: ${pending.length}`);
    for (const mig of pending) {
      console.log(`  ${mig.filename} (checksum: ${mig.checksum.substring(0, 12)}...)`);
    }
    console.log('');

    if (dryRun) {
      console.log('🏁 Dry run complete. No changes made.');
      return;
    }

    for (const mig of pending) {
      // For migration 033, acquire the shared advisory lock used by the production
      // deploy and rollback scripts. This makes the re-check + apply sequence
      // atomic with respect to the concurrent deployer, closing the TOCTOU race
      // where the deployer could insert IN_PROGRESS: between our re-check and apply.
      const is033 = mig.filename.startsWith('033');
      const LOCK_KEY_033 = 2033033033;
      if (is033) {
        const lockRes = await client.query(
          `SELECT pg_advisory_lock($1)`, [LOCK_KEY_033]
        );
        // Lock acquired — deployer cannot be running concurrently now
      }

      try {
        // Re-check migration state while holding the lock (for 033) or immediately (for others).
        const recheck = await client.query(
          `SELECT checksum FROM migration.schema_migrations WHERE filename = $1`,
          [mig.filename]
        );
        if (recheck.rows.length > 0) {
          const rc = recheck.rows[0].checksum;
          if (rc.startsWith('IN_PROGRESS:')) {
            console.log(`  🛑 ${mig.filename}: Production concurrent deployment in progress. Skipping.`);
          } else {
            console.log(`  ⏭ ${mig.filename}: Applied by another process (checksum=${rc.substring(0, 12)}...). Skipping.`);
          }
          continue;
        }

        const sql = fs.readFileSync(mig.filepath, 'utf-8');
        const startMs = Date.now();

        console.log(`▶ Applying ${mig.filename}...`);

        await client.query(sql);
        const elapsedMs = Date.now() - startMs;

        // Record in schema_migrations
        await client.query(
          `INSERT INTO migration.schema_migrations (filename, checksum, execution_time_ms)
           VALUES ($1, $2, $3)
           ON CONFLICT (filename) DO UPDATE SET checksum = $2, execution_time_ms = $3, applied_at = NOW()`,
          [mig.filename, mig.checksum, elapsedMs]
        );

        console.log(`  ✅ ${mig.filename} (${elapsedMs}ms)`);
      } catch (err: any) {
        console.error(`  ❌ ${mig.filename} FAILED: ${err.message}`);
        console.error(`\n🛑 Migration aborted. Fix the error and re-run.`);
        console.error(`   Last successful: ${pending.indexOf(mig) > 0 ? pending[pending.indexOf(mig) - 1].filename : 'none'}`);
        process.exit(1);
      } finally {
        // Release advisory lock if we acquired it
        if (is033) {
          await client.query(`SELECT pg_advisory_unlock($1)`, [LOCK_KEY_033]).catch(() => {});
        }
      }
    }

    console.log(`\n✅ All ${pending.length} migrations applied successfully.`);

  } finally {
    await client.end();
  }
};

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
