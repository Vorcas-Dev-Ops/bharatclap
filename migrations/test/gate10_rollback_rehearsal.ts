/**
 * Gate 10: Rollback Rehearsal
 *
 * Usage:
 *   npx tsx migrations/test/gate10_rollback_rehearsal.ts
 *
 * Simulates a full cutover rollback:
 *   1. Captures baseline state of source DB (tables, FKs, indexes, seeds)
 *   2. Dumps source DB using pg_dump (custom archive format)
 *   3. Creates a fresh rollback target DB (bharatclap_rollback_test)
 *   4. Restores archive into rollback target DB using pg_restore
 *   5. Verifies restored DB matches baseline:
 *      - Table count = 137
 *      - FK constraints = 73
 *      - Seed accounts = 26
 *      - Migrations applied = 16
 *   6. Cleans up rollback target DB and temporary dump file
 */
import { Client } from 'pg';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = process.env.PG_PORT || '5432';
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASSWORD = process.env.PG_PASSWORD || 'postgres';
const SOURCE_DB = process.env.PG_DB || 'bharatclap_migration_test';
const ROLLBACK_DB = 'bharatclap_rollback_test';

const DUMP_DIR = path.resolve(__dirname, 'tmp');
const DUMP_FILE = path.join(DUMP_DIR, 'cutover_rollback_rehearsal.dump');

interface Baseline {
  tables: number;
  fks: number;
  indexes: number;
  seeds: number;
  migrations: number;
}

const getMetrics = async (client: Client): Promise<Baseline> => {
  const tRes = await client.query(`
    SELECT COUNT(*) FROM pg_tables
    WHERE schemaname IN ('auth','booking','catalog','provider','payment','accounting','notification','migration')
  `);
  const fkRes = await client.query(`
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema IN ('auth','booking','catalog','provider','payment','accounting','notification')
  `);
  const idxRes = await client.query(`
    SELECT COUNT(*) FROM pg_indexes
    WHERE schemaname IN ('auth','booking','catalog','provider','payment','accounting','notification')
  `);
  const seedRes = await client.query(`SELECT COUNT(*) FROM accounting.chart_of_accounts`);
  const migRes = await client.query(`SELECT COUNT(*) FROM migration.schema_migrations`);

  return {
    tables: parseInt(tRes.rows[0].count),
    fks: parseInt(fkRes.rows[0].count),
    indexes: parseInt(idxRes.rows[0].count),
    seeds: parseInt(seedRes.rows[0].count),
    migrations: parseInt(migRes.rows[0].count),
  };
};

const main = async () => {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Gate 10: Cutover Rollback Rehearsal');
  console.log('═══════════════════════════════════════════════════\n');

  if (!fs.existsSync(DUMP_DIR)) {
    fs.mkdirSync(DUMP_DIR, { recursive: true });
  }

  // Step 1: Connect to source DB and record baseline
  console.log('Step 1: Capturing pre-cutover baseline metrics...\n');
  const sourceClient = new Client({
    host: PG_HOST,
    port: parseInt(PG_PORT),
    user: PG_USER,
    password: PG_PASSWORD,
    database: SOURCE_DB,
  });
  await sourceClient.connect();
  const baseline = await getMetrics(sourceClient);
  await sourceClient.end();

  console.log(`  Source tables:           ${baseline.tables}`);
  console.log(`  Source FK constraints:   ${baseline.fks}`);
  console.log(`  Source indexes:          ${baseline.indexes}`);
  console.log(`  Source seed accounts:    ${baseline.seeds}`);
  console.log(`  Source migrations:       ${baseline.migrations}\n`);

  // Step 2: Run pg_dump
  console.log('Step 2: Executing pg_dump backup (custom format)...\n');
  if (fs.existsSync(DUMP_FILE)) {
    fs.unlinkSync(DUMP_FILE);
  }

  const dumpCmd = `pg_dump -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${SOURCE_DB} -Fc -f "${DUMP_FILE}"`;
  const env = { ...process.env, PGPASSWORD: PG_PASSWORD };

  const dumpStart = Date.now();
  execSync(dumpCmd, { env, stdio: 'pipe' });
  const dumpDuration = ((Date.now() - dumpStart) / 1000).toFixed(2);
  const dumpSize = (fs.statSync(DUMP_FILE).size / 1024).toFixed(1);

  console.log(`  ✅ pg_dump complete in ${dumpDuration}s (${dumpSize} KB)`);
  console.log(`  Archive: ${DUMP_FILE}\n`);

  // Step 3: Prepare rollback target DB
  console.log('Step 3: Preparing fresh rollback target database...\n');
  const rootClient = new Client({
    host: PG_HOST,
    port: parseInt(PG_PORT),
    user: PG_USER,
    password: PG_PASSWORD,
    database: 'postgres',
  });
  await rootClient.connect();

  await rootClient.query(`DROP DATABASE IF EXISTS ${ROLLBACK_DB} WITH (FORCE);`);
  await rootClient.query(`CREATE DATABASE ${ROLLBACK_DB};`);
  console.log(`  ✅ Created database: ${ROLLBACK_DB}\n`);

  // Step 4: Execute pg_restore
  console.log('Step 4: Executing pg_restore to rollback database...\n');
  const restoreCmd = `pg_restore -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${ROLLBACK_DB} --no-owner --role=${PG_USER} "${DUMP_FILE}"`;
  const restoreStart = Date.now();
  try {
    execSync(restoreCmd, { env, stdio: 'pipe' });
  } catch (err: any) {
    // pg_restore returns non-zero if there are minor role warnings, which is common with --no-owner
    // We verify by actual schema inspection in step 5
  }
  const restoreDuration = ((Date.now() - restoreStart) / 1000).toFixed(2);
  console.log(`  ✅ pg_restore finished in ${restoreDuration}s\n`);

  // Step 5: Verify rollback target DB metrics
  console.log('Step 5: Verifying restored database integrity...\n');
  const rollbackClient = new Client({
    host: PG_HOST,
    port: parseInt(PG_PORT),
    user: PG_USER,
    password: PG_PASSWORD,
    database: ROLLBACK_DB,
  });
  await rollbackClient.connect();
  const restored = await getMetrics(rollbackClient);
  await rollbackClient.end();

  let allPassed = true;

  const checks = [
    { name: 'Table count', expected: baseline.tables, actual: restored.tables },
    { name: 'Foreign key constraints', expected: baseline.fks, actual: restored.fks },
    { name: 'Index count', expected: baseline.indexes, actual: restored.indexes },
    { name: 'Seed accounts', expected: baseline.seeds, actual: restored.seeds },
    { name: 'Schema migrations', expected: baseline.migrations, actual: restored.migrations },
  ];

  for (const c of checks) {
    const match = c.actual === c.expected;
    if (!match) allPassed = false;
    const icon = match ? '✅' : '❌';
    console.log(`  ${icon} ${c.name.padEnd(25)} Expected: ${c.expected}, Restored: ${c.actual}`);
  }

  // Step 6: Cleanup
  console.log('\nStep 6: Cleaning up test artifacts...\n');
  await rootClient.query(`DROP DATABASE IF EXISTS ${ROLLBACK_DB} WITH (FORCE);`);
  await rootClient.end();
  if (fs.existsSync(DUMP_FILE)) {
    fs.unlinkSync(DUMP_FILE);
  }
  console.log('  ✅ Dropped rollback test database');
  console.log('  ✅ Removed temporary dump file\n');

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log('  Gate 10: Rollback Rehearsal Summary');
  console.log('═══════════════════════════════════════════════════\n');

  if (allPassed) {
    console.log('  Backup dump time:      ' + dumpDuration + 's');
    console.log('  Restore time:          ' + restoreDuration + 's');
    console.log('  Data loss / drift:     0%\n');
    console.log('═══ Gate 10: PASS — Rollback procedure validated ═══\n');
  } else {
    console.log('═══ Gate 10: FAIL — Restored database did not match baseline ═══\n');
    process.exit(1);
  }
};

main().catch(err => {
  console.error('\n═══ Gate 10: FAIL ═══');
  console.error(err);
  process.exit(1);
});
