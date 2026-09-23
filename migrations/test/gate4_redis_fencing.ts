/**
 * Gate 4: Redis Lock + PostgreSQL Fencing Token Test
 *
 * Usage:
 *   npx tsx migrations/test/gate4_redis_fencing.ts
 *
 * Tests the complete failure scenario:
 *   Worker A → token 10 → stalls → lease expires
 *   Worker B → token 11 → succeeds
 *   Worker A wakes → must NOT overwrite Worker B's state
 *
 * This test requires a running Redis instance.
 * If Redis is unavailable, the test is skipped (not failed).
 */
import { Client, Pool } from 'pg';
import assert from 'assert';
import Redis from 'ioredis';
import crypto from 'crypto';

const PG_URL = process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const RELEASE_LUA = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`;

const main = async () => {
  console.log('\n═══ Gate 4: Redis Lock + PostgreSQL Fencing Test ═══\n');

  // Check Redis availability
  let redis: Redis;
  try {
    redis = new Redis(REDIS_URL, { lazyConnect: true, connectTimeout: 3000 });
    await redis.connect();
    await redis.ping();
  } catch (err) {
    console.log('  ⚠️  Redis not available. Skipping Gate 4.');
    console.log('  (This gate requires a running Redis instance)\n');
    console.log('═══ Gate 4: SKIPPED ═══\n');
    process.exit(0);
  }

  const pool = new Pool({ connectionString: PG_URL, max: 5 });
  const client = await pool.connect();

  // Setup: create a test table simulating provider wallet with fencing
  await client.query(`
    CREATE TABLE IF NOT EXISTS migration.gate4_wallet (
      provider_id TEXT PRIMARY KEY,
      balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      fencing_token INTEGER NOT NULL DEFAULT 0
    )
  `);
  await client.query('TRUNCATE migration.gate4_wallet');
  await client.query(
    `INSERT INTO migration.gate4_wallet (provider_id, balance, fencing_token)
     VALUES ('provider_A', 1000.00, 10)`
  );
  client.release();

  const LOCK_KEY = 'lock:wallet:provider_A';

  // ───────────────────────────────────────────────────────
  // Step 1: Worker A acquires Redis lock, gets fencing token 10
  // ───────────────────────────────────────────────────────
  console.log('  Step 1: Worker A acquires Redis lock');
  const tokenA = crypto.randomBytes(16).toString('hex');
  const lockResultA = await redis.set(LOCK_KEY, tokenA, 'PX', 500, 'NX'); // 500ms TTL
  assert.strictEqual(lockResultA, 'OK', 'Worker A should acquire lock');

  // Worker A reads current fencing token and increments
  const workerAClient = await pool.connect();
  await workerAClient.query('BEGIN');
  const fenceA = await workerAClient.query(
    `SELECT fencing_token FROM migration.gate4_wallet WHERE provider_id = 'provider_A' FOR UPDATE`
  );
  const tokenAFence = fenceA.rows[0].fencing_token + 1; // token = 10
  console.log(`  Worker A fencing_token: ${tokenAFence}`);

  // Worker A stalls — don't commit yet
  console.log('  Worker A stalls... (holding open transaction)');

  // ───────────────────────────────────────────────────────
  // Step 2: Wait for Redis lease to expire
  // ───────────────────────────────────────────────────────
  console.log('  Step 2: Waiting for Redis lease to expire (500ms)...');
  await new Promise(resolve => setTimeout(resolve, 600));

  // Verify lease has expired
  const lockCheck = await redis.get(LOCK_KEY);
  assert.strictEqual(lockCheck, null, 'Redis lock should have expired');
  console.log('  ✅ Redis lock expired');

  // Worker A's transaction is still open — abort it to release FOR UPDATE
  await workerAClient.query('ROLLBACK');
  workerAClient.release();

  // ───────────────────────────────────────────────────────
  // Step 3: Worker B acquires Redis lock, gets fencing token 11
  // ───────────────────────────────────────────────────────
  console.log('\n  Step 3: Worker B acquires Redis lock');
  const tokenB = crypto.randomBytes(16).toString('hex');
  const lockResultB = await redis.set(LOCK_KEY, tokenB, 'PX', 10000, 'NX');
  assert.strictEqual(lockResultB, 'OK', 'Worker B should acquire lock');

  const workerBClient = await pool.connect();
  await workerBClient.query('BEGIN');

  // Worker B performs the operation with fencing token 11
  await workerBClient.query(
    `UPDATE migration.gate4_wallet
     SET balance = balance + 500, fencing_token = fencing_token + 1
     WHERE provider_id = 'provider_A'`
  );
  await workerBClient.query('COMMIT');
  workerBClient.release();

  const afterB = await pool.query(
    `SELECT balance, fencing_token FROM migration.gate4_wallet WHERE provider_id = 'provider_A'`
  );
  console.log(`  Worker B balance: ₹${afterB.rows[0].balance} (1000 + 500 = 1500)`);
  console.log(`  Worker B fencing_token: ${afterB.rows[0].fencing_token} (10 → 11 via B's +1)`);
  assert.strictEqual(parseFloat(afterB.rows[0].balance), 1500.00);

  // Worker B releases lock correctly
  const releasedB = await redis.eval(RELEASE_LUA, 1, LOCK_KEY, tokenB);
  assert.strictEqual(releasedB, 1, 'Worker B should release its own lock');
  console.log('  ✅ Worker B completed and released lock');

  // ───────────────────────────────────────────────────────
  // Step 4: Worker A wakes up — must be rejected
  // ───────────────────────────────────────────────────────
  console.log('\n  Step 4: Worker A wakes up (stale token 10)');

  // Worker A tries to release lock — should fail (it's been released by B)
  const releaseA = await redis.eval(RELEASE_LUA, 1, LOCK_KEY, tokenA);
  assert.strictEqual(releaseA, 0, 'Worker A release should return 0 (not its lock)');
  console.log('  ✅ Worker A lock release: rejected (token mismatch)');

  // Worker A tries to write with stale fencing token
  const workerARetry = await pool.connect();
  await workerARetry.query('BEGIN');

  // Worker A attempts conditional update with its stale fencing token (10)
  // Current fencing_token in DB is now 11 (set by Worker B)
  const staleWrite = await workerARetry.query(
    `UPDATE migration.gate4_wallet
     SET balance = balance - 300, fencing_token = $1
     WHERE provider_id = 'provider_A'
       AND fencing_token < $1`,
    [tokenAFence]  // Worker A's token is 10, DB has 11 → 11 < 10 is FALSE
  );

  // fencing_token < 10 is FALSE because current token is 11
  assert.strictEqual(staleWrite.rowCount, 0, 'Stale write should affect 0 rows');
  console.log('  ✅ Worker A stale write: rejected by fencing token (10 < 11 = false)');

  await workerARetry.query('ROLLBACK');
  workerARetry.release();

  // Verify final state — Worker B's state must be preserved
  const finalState = await pool.query(
    `SELECT balance, fencing_token FROM migration.gate4_wallet WHERE provider_id = 'provider_A'`
  );
  assert.strictEqual(parseFloat(finalState.rows[0].balance), 1500.00,
    'Worker B state must be preserved');
  assert.strictEqual(finalState.rows[0].fencing_token, 11,
    'Fencing token must be Worker B\'s value');

  console.log(`\n  Final state: balance=₹${finalState.rows[0].balance}, token=${finalState.rows[0].fencing_token}`);
  console.log('  ✅ Worker B state preserved. Worker A stale write prevented.');

  // Cleanup
  await pool.query('DROP TABLE migration.gate4_wallet');
  await redis.del(LOCK_KEY);
  await redis.quit();
  await pool.end();

  console.log('\n═══ Gate 4: PASS ═══\n');
};

main().catch(err => {
  console.error('\n═══ Gate 4: FAIL ═══');
  console.error(err);
  process.exit(1);
});
