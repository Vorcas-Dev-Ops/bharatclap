/**
 * Gate 4b: Concurrent Fencing Token Allocation Test
 *
 * Usage:
 *   npx tsx migrations/test/gate4b_concurrent_fencing.ts
 *
 * Spawns 100 concurrent workers, each atomically incrementing a fencing_token
 * via UPDATE ... RETURNING. Verifies: 100 unique sequential tokens, zero duplicates.
 *
 * This proves the fencing token is generated atomically inside PG,
 * NOT via a read-then-increment pattern.
 */
import { Pool } from 'pg';
import assert from 'assert';

const PG_URL = process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
const WORKER_COUNT = 100;

const main = async () => {
  console.log('\n═══ Gate 4b: Concurrent Fencing Token Allocation ═══\n');

  const pool = new Pool({ connectionString: PG_URL, max: 20 });

  // Setup
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migration.gate4b_fencing (
      provider_id TEXT PRIMARY KEY,
      fencing_token INTEGER NOT NULL DEFAULT 0
    )
  `);
  await pool.query('TRUNCATE migration.gate4b_fencing');
  await pool.query(
    `INSERT INTO migration.gate4b_fencing (provider_id, fencing_token)
     VALUES ('test_provider', 0)`
  );

  // Spawn 100 concurrent workers, each atomically incrementing fencing_token
  console.log(`  Spawning ${WORKER_COUNT} concurrent workers...\n`);

  const results = await Promise.all(
    Array.from({ length: WORKER_COUNT }, (_, i) =>
      (async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // Atomic increment: single UPDATE ... RETURNING — no read-then-write race
          const res = await client.query(
            `UPDATE migration.gate4b_fencing
             SET fencing_token = fencing_token + 1
             WHERE provider_id = 'test_provider'
             RETURNING fencing_token`
          );
          const token = res.rows[0].fencing_token;
          await client.query('COMMIT');
          return { worker: i, token };
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      })()
    )
  );

  // Verify: 100 unique tokens, 1 through 100
  const tokens = results.map(r => r.token).sort((a, b) => a - b);
  const uniqueTokens = new Set(tokens);

  console.log(`  Tokens allocated: ${tokens.length}`);
  console.log(`  Unique tokens:    ${uniqueTokens.size}`);
  console.log(`  Min token:        ${tokens[0]}`);
  console.log(`  Max token:        ${tokens[tokens.length - 1]}`);

  // Check uniqueness
  assert.strictEqual(uniqueTokens.size, WORKER_COUNT,
    `Expected ${WORKER_COUNT} unique tokens, got ${uniqueTokens.size}`);
  console.log(`  ✅ All ${WORKER_COUNT} tokens are unique`);

  // Check sequential (1 through 100)
  const expected = Array.from({ length: WORKER_COUNT }, (_, i) => i + 1);
  assert.deepStrictEqual(tokens, expected,
    `Tokens should be sequential 1-${WORKER_COUNT}`);
  console.log(`  ✅ Tokens are sequential: 1 → ${WORKER_COUNT}`);

  // Final DB state
  const finalRow = await pool.query(
    `SELECT fencing_token FROM migration.gate4b_fencing WHERE provider_id = 'test_provider'`
  );
  assert.strictEqual(finalRow.rows[0].fencing_token, WORKER_COUNT);
  console.log(`  ✅ Final fencing_token in DB: ${finalRow.rows[0].fencing_token}`);

  // Cleanup
  await pool.query('DROP TABLE migration.gate4b_fencing');
  await pool.end();

  console.log('\n═══ Gate 4b: PASS ═══\n');
};

main().catch(err => {
  console.error('\n═══ Gate 4b: FAIL ═══');
  console.error(err);
  process.exit(1);
});
