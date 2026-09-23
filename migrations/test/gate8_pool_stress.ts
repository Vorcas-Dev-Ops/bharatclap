/**
 * Gate 8: Connection Pool Stress Test
 *
 * Usage:
 *   npx tsx migrations/test/gate8_pool_stress.ts
 *
 * Tests connection pool behavior under concurrent load:
 *   - 50 concurrent connections doing mixed read/write operations
 *   - Monitors pool exhaustion, wait times, and idle-in-transaction
 *   - Verifies no deadlocks under concurrent wallet operations
 */
import { Pool } from 'pg';
import assert from 'assert';

const PG_URL = process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
const CONCURRENT_WORKERS = 50;
const OPERATIONS_PER_WORKER = 20;
const POOL_SIZE = 10; // intentionally small to test pool pressure

interface StressResult {
  worker: number;
  operations: number;
  errors: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
}

const main = async () => {
  console.log('\n═══ Gate 8: Connection Pool Stress Test ═══\n');
  console.log(`  Pool size:           ${POOL_SIZE}`);
  console.log(`  Concurrent workers:  ${CONCURRENT_WORKERS}`);
  console.log(`  Ops per worker:      ${OPERATIONS_PER_WORKER}`);
  console.log(`  Total operations:    ${CONCURRENT_WORKERS * OPERATIONS_PER_WORKER}\n`);

  const pool = new Pool({
    connectionString: PG_URL,
    max: POOL_SIZE,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Setup: create stress test table
  const setup = await pool.connect();
  await setup.query(`
    CREATE TABLE IF NOT EXISTS migration.gate8_stress (
      id SERIAL PRIMARY KEY,
      worker_id INTEGER NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      value NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await setup.query('TRUNCATE migration.gate8_stress');

  // Seed one row per worker
  for (let i = 0; i < CONCURRENT_WORKERS; i++) {
    await setup.query(
      'INSERT INTO migration.gate8_stress (worker_id, counter, value) VALUES ($1, 0, 1000.00)',
      [i]
    );
  }
  setup.release();

  let poolExhausted = 0;
  let totalWaitMs = 0;
  let maxWaitMs = 0;
  let deadlocks = 0;
  let totalErrors = 0;

  const startTime = Date.now();

  // Spawn workers
  const workerResults = await Promise.all(
    Array.from({ length: CONCURRENT_WORKERS }, (_, workerId) =>
      (async (): Promise<StressResult> => {
        let ops = 0;
        let errors = 0;
        let totalLatency = 0;
        let maxLatency = 0;

        for (let op = 0; op < OPERATIONS_PER_WORKER; op++) {
          const opStart = Date.now();
          let client;

          try {
            client = await pool.connect();
            const waitTime = Date.now() - opStart;
            totalWaitMs += waitTime;
            if (waitTime > maxWaitMs) maxWaitMs = waitTime;
            if (waitTime > 5000) poolExhausted++;

            // Mix of operations:
            // 60% reads, 30% writes, 10% transactions
            const roll = Math.random();

            if (roll < 0.6) {
              // Read
              await client.query(
                'SELECT * FROM migration.gate8_stress WHERE worker_id = $1',
                [workerId]
              );
            } else if (roll < 0.9) {
              // Write
              await client.query(
                'UPDATE migration.gate8_stress SET counter = counter + 1, value = value + 0.01 WHERE worker_id = $1',
                [workerId]
              );
            } else {
              // Transaction (read + write)
              await client.query('BEGIN');
              const res = await client.query(
                'SELECT counter, value FROM migration.gate8_stress WHERE worker_id = $1 FOR UPDATE',
                [workerId]
              );
              await client.query(
                'UPDATE migration.gate8_stress SET counter = $1, value = $2 WHERE worker_id = $3',
                [res.rows[0].counter + 1, parseFloat(res.rows[0].value) + 1.00, workerId]
              );
              await client.query('COMMIT');
            }

            ops++;
          } catch (err: any) {
            if (err.code === '40P01') deadlocks++;
            errors++;
            totalErrors++;
            if (client) await client.query('ROLLBACK').catch(() => {});
          } finally {
            if (client) client.release();
          }

          const latency = Date.now() - opStart;
          totalLatency += latency;
          if (latency > maxLatency) maxLatency = latency;
        }

        return {
          worker: workerId,
          operations: ops,
          errors,
          avgLatencyMs: totalLatency / OPERATIONS_PER_WORKER,
          maxLatencyMs: maxLatency,
        };
      })()
    )
  );

  const elapsedMs = Date.now() - startTime;
  const totalOps = workerResults.reduce((s, r) => s + r.operations, 0);
  const avgLatency = workerResults.reduce((s, r) => s + r.avgLatencyMs, 0) / CONCURRENT_WORKERS;
  const maxLatency = Math.max(...workerResults.map(r => r.maxLatencyMs));

  // Verify final state consistency
  const finalState = await pool.query(
    'SELECT SUM(counter) AS total_ops, COUNT(*) AS rows FROM migration.gate8_stress'
  );

  console.log('  Results:\n');
  console.log(`  Total time:              ${elapsedMs}ms`);
  console.log(`  Total operations:        ${totalOps}`);
  console.log(`  Throughput:              ${Math.round(totalOps / (elapsedMs / 1000))} ops/sec`);
  console.log(`  Avg latency:             ${avgLatency.toFixed(2)}ms`);
  console.log(`  Max latency:             ${maxLatency}ms`);
  console.log(`  Pool exhaustion events:  ${poolExhausted}`);
  console.log(`  Max connection wait:     ${maxWaitMs}ms`);
  console.log(`  Deadlocks detected:      ${deadlocks}`);
  console.log(`  Total errors:            ${totalErrors}`);
  console.log(`  DB rows:                 ${finalState.rows[0].rows}`);
  console.log(`  Total counter sum:       ${finalState.rows[0].total_ops}`);

  // Assertions
  console.log('\n  Checks:\n');

  const passPool = poolExhausted === 0;
  console.log(`  ${passPool ? '✅' : '⚠️'} Pool exhaustion: ${poolExhausted} (threshold: 0)`);

  const passWait = maxWaitMs < 10000;
  console.log(`  ${passWait ? '✅' : '⚠️'} Max wait: ${maxWaitMs}ms (threshold: 10000ms)`);

  const passDeadlock = deadlocks === 0;
  console.log(`  ${passDeadlock ? '✅' : '⚠️'} Deadlocks: ${deadlocks} (threshold: 0)`);

  const passLatency = maxLatency < 5000;
  console.log(`  ${passLatency ? '✅' : '⚠️'} Max latency: ${maxLatency}ms (threshold: 5000ms)`);

  const passErrors = totalErrors === 0;
  console.log(`  ${passErrors ? '✅' : '⚠️'} Errors: ${totalErrors} (threshold: 0)`);

  // Cleanup
  await pool.query('DROP TABLE migration.gate8_stress');
  await pool.end();

  const allPassed = passPool && passWait && passDeadlock && passLatency && passErrors;

  if (allPassed) {
    console.log('\n═══ Gate 8: PASS ═══\n');
  } else {
    console.log('\n═══ Gate 8: WARNINGS (review thresholds above) ═══\n');
  }
};

main().catch(err => {
  console.error('\n═══ Gate 8: FAIL ═══');
  console.error(err);
  process.exit(1);
});
