/**
 * Gate 3: Retry/Idempotency Test
 *
 * Usage:
 *   npx tsx migrations/test/gate3_retry_idempotency.ts
 *
 * Tests that withPgRetry() retries the WHOLE transaction on serialization
 * failure, and produces exactly ONE final business effect.
 */
import { Client, Pool } from 'pg';
import assert from 'assert';
import { classifyPgError, withPgRetry } from '../../shared/src/utils/pgErrors';

const PG_URL = process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';

const main = async () => {
  console.log('\n═══ Gate 3: Retry/Idempotency Test ═══\n');

  const pool = new Pool({ connectionString: PG_URL, max: 5 });

  // Setup: create a test table simulating a wallet
  const setup = await pool.connect();
  await setup.query(`
    CREATE TABLE IF NOT EXISTS migration.gate3_wallet (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id TEXT UNIQUE NOT NULL,
      balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 0
    )
  `);
  await setup.query('TRUNCATE migration.gate3_wallet');
  await setup.query(
    `INSERT INTO migration.gate3_wallet (provider_id, balance, version)
     VALUES ('test_provider', 1000.00, 0)`
  );

  await setup.query(`
    CREATE TABLE IF NOT EXISTS migration.gate3_txlog (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await setup.query('TRUNCATE migration.gate3_txlog');
  setup.release();

  // ───────────────────────────────────────────────────────
  // Test 1: Serialization failure → retry → exactly 1 effect
  // ───────────────────────────────────────────────────────
  console.log('  Test 1: Serialization failure simulation\n');

  let attemptCount = 0;
  const DEBIT_AMOUNT = 200;

  await withPgRetry(async () => {
    attemptCount++;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Simulate serialization failure on first attempt
      if (attemptCount === 1) {
        await client.query('ROLLBACK');
        const err: any = new Error('could not serialize access');
        err.code = '40001'; // serialization_failure
        throw err;
      }

      // Debit wallet
      const result = await client.query(
        `UPDATE migration.gate3_wallet
         SET balance = balance - $1, version = version + 1
         WHERE provider_id = 'test_provider'
         RETURNING balance, version`,
        [DEBIT_AMOUNT]
      );

      // Record transaction
      await client.query(
        `INSERT INTO migration.gate3_txlog (provider_id, amount)
         VALUES ('test_provider', $1)`,
        [DEBIT_AMOUNT]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }, {
    maxRetries: 3,
    onRetry: (info, attempt) => {
      console.log(`    Attempt ${attempt}: ${info.category} (${info.code}) → retrying`);
    }
  });

  // Verify: exactly 1 debit, exactly 1 txlog entry
  const verify = await pool.connect();

  const walletResult = await verify.query(
    `SELECT balance, version FROM migration.gate3_wallet WHERE provider_id = 'test_provider'`
  );
  assert.strictEqual(parseFloat(walletResult.rows[0].balance), 800.00,
    `Expected balance 800.00, got ${walletResult.rows[0].balance}`);
  assert.strictEqual(walletResult.rows[0].version, 1,
    `Expected version 1, got ${walletResult.rows[0].version}`);
  console.log(`  ✅ Balance: ₹${walletResult.rows[0].balance} (correct: 1000 - 200 = 800)`);
  console.log(`  ✅ Version: ${walletResult.rows[0].version} (exactly 1 increment)`);
  console.log(`  ✅ Attempts: ${attemptCount} (1 failed + 1 succeeded)`);

  const txCount = await verify.query(
    `SELECT COUNT(*) FROM migration.gate3_txlog WHERE provider_id = 'test_provider'`
  );
  assert.strictEqual(parseInt(txCount.rows[0].count), 1,
    `Expected 1 txlog entry, got ${txCount.rows[0].count}`);
  console.log(`  ✅ Transaction log: ${txCount.rows[0].count} entry (exactly 1 business effect)`);

  // ───────────────────────────────────────────────────────
  // Test 2: Deadlock → retry → exactly 1 effect
  // ───────────────────────────────────────────────────────
  console.log('\n  Test 2: Deadlock simulation\n');

  await verify.query(
    `UPDATE migration.gate3_wallet SET balance = 1000.00, version = 0 WHERE provider_id = 'test_provider'`
  );
  await verify.query('TRUNCATE migration.gate3_txlog');
  verify.release();

  let deadlockAttempts = 0;

  await withPgRetry(async () => {
    deadlockAttempts++;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (deadlockAttempts === 1) {
        await client.query('ROLLBACK');
        const err: any = new Error('deadlock detected');
        err.code = '40P01';
        throw err;
      }

      await client.query(
        `UPDATE migration.gate3_wallet SET balance = balance - 150, version = version + 1
         WHERE provider_id = 'test_provider'`
      );
      await client.query(
        `INSERT INTO migration.gate3_txlog (provider_id, amount) VALUES ('test_provider', 150)`
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }, { maxRetries: 3 });

  const v2 = await pool.connect();
  const dl = await v2.query(
    `SELECT balance, version FROM migration.gate3_wallet WHERE provider_id = 'test_provider'`
  );
  assert.strictEqual(parseFloat(dl.rows[0].balance), 850.00);
  const dlTx = await v2.query(`SELECT COUNT(*) FROM migration.gate3_txlog`);
  assert.strictEqual(parseInt(dlTx.rows[0].count), 1);
  console.log(`  ✅ Balance: ₹${dl.rows[0].balance} (correct: 1000 - 150 = 850)`);
  console.log(`  ✅ Transaction log: ${dlTx.rows[0].count} entry (exactly 1)`);
  console.log(`  ✅ Deadlock attempts: ${deadlockAttempts} (1 failed + 1 succeeded)`);

  // ───────────────────────────────────────────────────────
  // Test 3: Non-retryable error → no retry, immediate throw
  // ───────────────────────────────────────────────────────
  console.log('\n  Test 3: Non-retryable error (constraint violation)\n');

  let constraintAttempts = 0;
  try {
    await withPgRetry(async () => {
      constraintAttempts++;
      const err: any = new Error('check constraint violated');
      err.code = '23514';
      throw err;
    }, { maxRetries: 3 });
    assert.fail('Should have thrown');
  } catch (err: any) {
    assert.strictEqual(err.code, '23514');
    assert.strictEqual(constraintAttempts, 1, 'Should NOT retry constraint violations');
    console.log(`  ✅ Constraint violation: threw immediately (${constraintAttempts} attempt, 0 retries)`);
  }

  // Cleanup
  await v2.query('DROP TABLE migration.gate3_wallet');
  await v2.query('DROP TABLE migration.gate3_txlog');
  v2.release();
  await pool.end();

  console.log('\n═══ Gate 3: PASS ═══\n');
};

main().catch(err => {
  console.error('\n═══ Gate 3: FAIL ═══');
  console.error(err);
  process.exit(1);
});
