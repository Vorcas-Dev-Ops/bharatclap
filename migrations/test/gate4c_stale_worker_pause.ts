/**
 * Gate 4c: Long-Pause Stale Writer Rejection Test
 *
 * Usage:
 *   npx tsx migrations/test/gate4c_stale_worker_pause.ts
 *
 * Scenario:
 *   1. Worker A acquires Redis lock (1000ms TTL)
 *   2. Worker A fetches current fencing token: 100 -> allocates 101
 *   3. Worker A pauses/stalls for 1500ms (simulating GC pause, network partition, or slow external call)
 *   4. Redis lock expires
 *   5. Worker B acquires Redis lock
 *   6. Worker B allocates fencing token 102 and writes balance ₹1800.00 successfully
 *   7. Worker A wakes up and attempts write with stale token 101
 *   8. Worker A's write MUST FAIL (0 rows updated via WHERE fencing_token < 101)
 *   9. Final database state MUST preserve Worker B's update (₹1800.00, token 102)
 */
import { Pool } from 'pg';
import assert from 'assert';
import Redis from 'ioredis';
import crypto from 'crypto';

const PG_URL = process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const main = async () => {
  console.log('\n═══ Gate 4c: Long-Pause Stale Writer Rejection Test ═══\n');

  let redis: Redis;
  try {
    redis = new Redis(REDIS_URL, { lazyConnect: true, connectTimeout: 3000 });
    await redis.connect();
    await redis.ping();
  } catch (err) {
    console.log('  ⚠️  Redis not available. Skipping Gate 4c.');
    process.exit(0);
  }

  const pool = new Pool({ connectionString: PG_URL, max: 5 });
  const client = await pool.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS migration.gate4c_wallet (
      provider_id TEXT PRIMARY KEY,
      balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      fencing_token INTEGER NOT NULL DEFAULT 0
    )
  `);
  await client.query('TRUNCATE migration.gate4c_wallet');
  await client.query(
    `INSERT INTO migration.gate4c_wallet (provider_id, balance, fencing_token)
     VALUES ('provider_pause_test', 1000.00, 100)`
  );
  client.release();

  const LOCK_KEY = 'lock:wallet:provider_pause_test';

  // 1. Worker A acquires Redis lock with 1000ms TTL
  console.log('  Step 1: Worker A acquires Redis lock (TTL: 1000ms)');
  const tokenA = crypto.randomBytes(16).toString('hex');
  const lockA = await redis.set(LOCK_KEY, tokenA, 'PX', 1000, 'NX');
  assert.strictEqual(lockA, 'OK', 'Worker A must acquire lock');

  // Worker A allocates token 101
  const clientA = await pool.connect();
  const resA = await clientA.query(
    `SELECT balance, fencing_token FROM migration.gate4c_wallet WHERE provider_id = 'provider_pause_test'`
  );
  const workerAFenceToken = resA.rows[0].fencing_token + 1; // 101
  const workerABalance = 1200.00; // Worker A wants to set 1200
  console.log(`    Worker A allocated fencing token: ${workerAFenceToken}`);

  // 2. Worker A pauses for 1400ms (exceeding 1000ms TTL)
  console.log('  Step 2: Worker A pauses for 1400ms (simulating GC pause / network split)...');
  const pausePromise = sleep(1400);

  // While Worker A is paused, wait 1100ms for TTL to expire
  await sleep(1100);
  const remainingTTL = await redis.pttl(LOCK_KEY);
  console.log(`    Redis lock state: TTL = ${remainingTTL}ms (lock expired: ${remainingTTL <= 0})`);

  // 3. Worker B acquires lock
  console.log('  Step 3: Worker B acquires Redis lock after TTL expiration');
  const tokenB = crypto.randomBytes(16).toString('hex');
  const lockB = await redis.set(LOCK_KEY, tokenB, 'PX', 2000, 'NX');
  assert.strictEqual(lockB, 'OK', 'Worker B must acquire lock after A expired');

  // Worker B allocates token 102 and writes balance 1800.00
  const clientB = await pool.connect();
  const resB = await clientB.query(
    `UPDATE migration.gate4c_wallet
     SET balance = 1800.00, fencing_token = fencing_token + 2
     WHERE provider_id = 'provider_pause_test'
     RETURNING balance, fencing_token`
  );
  console.log(`    Worker B updated wallet: balance = ₹${resB.rows[0].balance}, token = ${resB.rows[0].fencing_token}`);
  clientB.release();

  // Worker B releases Redis lock
  await redis.eval(
    `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`,
    1, LOCK_KEY, tokenB
  );
  console.log('    Worker B released Redis lock');

  // 4. Worker A resumes after 1400ms
  await pausePromise;
  console.log('  Step 4: Worker A wakes up and attempts wallet update with stale token (101)...');

  // Worker A attempts update with stale token 101
  const writeA = await clientA.query(
    `UPDATE migration.gate4c_wallet
     SET balance = $1, fencing_token = $2
     WHERE provider_id = 'provider_pause_test'
       AND fencing_token < $2`,
    [workerABalance, workerAFenceToken]
  );
  clientA.release();

  console.log(`    Worker A rows updated: ${writeA.rowCount}`);
  assert.strictEqual(writeA.rowCount, 0, 'Worker A stale update MUST be rejected (0 rows updated)');
  console.log('    ✅ Worker A update strictly rejected by PostgreSQL monotonic fencing guard!');

  // 5. Final State Verification
  console.log('  Step 5: Verifying final database state...');
  const verifyClient = await pool.connect();
  const finalState = await verifyClient.query(
    `SELECT balance, fencing_token FROM migration.gate4c_wallet WHERE provider_id = 'provider_pause_test'`
  );
  verifyClient.release();

  console.log(`    Final Balance:       ₹${finalState.rows[0].balance} (expected: ₹1800.00)`);
  console.log(`    Final Fencing Token: ${finalState.rows[0].fencing_token} (expected: 102)`);

  assert.strictEqual(finalState.rows[0].balance, '1800.00', 'Balance must reflect Worker B');
  assert.strictEqual(finalState.rows[0].fencing_token, 102, 'Token must reflect Worker B');

  // Cleanup
  const cleanClient = await pool.connect();
  await cleanClient.query('DROP TABLE IF EXISTS migration.gate4c_wallet');
  cleanClient.release();
  await pool.end();
  await redis.quit();

  console.log('\n═══ Gate 4c: PASS — Stale writer strictly blocked under long pause ═══\n');
};

main().catch(err => {
  console.error('\n═══ Gate 4c: FAIL ═══', err);
  process.exit(1);
});
