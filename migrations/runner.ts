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

  const pgUrl = process.env.DATABASE_URL || process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  console.log(`\n═══ BharatClap Migration Runner ═══`);
  console.log(`Database: ${pgUrl.replace(/\/\/.*:.*@/, '//<credentials>@')}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

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
        console.error(`❌ CHECKSUM MISMATCH: ${mig.filename}`);
        console.error(`   Applied:  ${prev.checksum}`);
        console.error(`   Current:  ${mig.checksum}`);
        console.error(`   Applied at: ${prev.applied_at}`);

        if (forceVersion !== null && mig.filename.startsWith(String(forceVersion).padStart(3,'0'))) {
          console.warn(`   ⚠️  --force specified. Continuing despite mismatch.`);
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
      const sql = fs.readFileSync(mig.filepath, 'utf-8');
      const startMs = Date.now();

      console.log(`▶ Applying ${mig.filename}...`);

      try {
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
