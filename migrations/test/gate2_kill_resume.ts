/**
 * Gate 2: Kill/Resume Test
 *
 * Usage:
 *   npx tsx migrations/test/gate2_kill_resume.ts
 *
 * Creates 500 test docs in Mongo, migrates 3 batches of 100, simulates kill,
 * resumes from checkpoint, verifies no duplicates and exact count/sum match.
 */
import { MongoClient, ObjectId } from 'mongodb';
import { Client, Pool } from 'pg';
import assert from 'assert';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bharatclap';
const PG_URL = process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
const SOURCE_DB = 'bharatclap';
const TEST_COLLECTION = '__gate2_test';
const TOTAL_DOCS = 500;
const BATCH_SIZE = 100;
const KILL_AFTER_BATCH = 3;

const main = async () => {
  console.log('\n═══ Gate 2: Kill/Resume Test ═══\n');

  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const db = mongo.db();
  const pgClient = new Client({ connectionString: PG_URL });
  await pgClient.connect();

  // Setup PG target table
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS migration.gate2_test (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_mongo_id TEXT UNIQUE NOT NULL,
      value NUMERIC(12,2) NOT NULL,
      name TEXT NOT NULL
    )
  `);
  await pgClient.query('TRUNCATE migration.gate2_test');

  // Clear previous checkpoint
  await pgClient.query(
    `DELETE FROM migration.checkpoints WHERE source_db = $1 AND collection_name = $2`,
    [SOURCE_DB, TEST_COLLECTION]
  );

  // Seed Mongo
  await db.collection(TEST_COLLECTION).drop().catch(() => {});
  const docs = Array.from({ length: TOTAL_DOCS }, (_, i) => ({
    _id: new ObjectId(),
    name: `test_doc_${String(i).padStart(4, '0')}`,
    value: (i + 1) * 10.50,
  }));
  await db.collection(TEST_COLLECTION).insertMany(docs);
  console.log(`  Seeded ${TOTAL_DOCS} documents into Mongo ${TEST_COLLECTION}`);

  // Phase 1: Migrate batches 1–3, then simulate kill
  let lastId: ObjectId | null = null;
  let totalInserted = 0;

  const pool = new Pool({ connectionString: PG_URL, max: 3 });

  for (let batch = 1; batch <= KILL_AFTER_BATCH; batch++) {
    const query: any = lastId ? { _id: { $gt: lastId } } : {};
    const batchDocs = await db.collection(TEST_COLLECTION)
      .find(query).sort({ _id: 1 }).limit(BATCH_SIZE).toArray();

    const client = await pool.connect();
    await client.query('BEGIN');
    let batchInserted = 0;
    for (const doc of batchDocs) {
      const r = await client.query(
        `INSERT INTO migration.gate2_test (legacy_mongo_id, value, name)
         VALUES ($1, $2, $3) ON CONFLICT (legacy_mongo_id) DO NOTHING`,
        [doc._id.toString(), doc.value, doc.name]
      );
      batchInserted += r.rowCount || 0;
    }
    await client.query('COMMIT');
    client.release();

    totalInserted += batchInserted;
    lastId = batchDocs[batchDocs.length - 1]._id;

    // Save checkpoint using actual table schema
    await pgClient.query(
      `INSERT INTO migration.checkpoints (source_db, collection_name, last_mongo_id, processed_count, inserted_count, status, started_at)
       VALUES ($1, $2, $3, $4, $5, 'in_progress', NOW())
       ON CONFLICT (source_db, collection_name)
       DO UPDATE SET last_mongo_id = $3, processed_count = $4, inserted_count = $5, status = 'in_progress'`,
      [SOURCE_DB, TEST_COLLECTION, lastId.toString(), batch * BATCH_SIZE, totalInserted]
    );

    console.log(`  Batch ${batch}: ${batchInserted} inserted (total: ${totalInserted})`);
  }

  console.log(`\n  💥 SIMULATED KILL after batch ${KILL_AFTER_BATCH}`);
  console.log(`  Checkpoint: last_mongo_id=${lastId}, inserted=${totalInserted}\n`);

  // Verify partial state
  const partialCount = await pgClient.query('SELECT COUNT(*) FROM migration.gate2_test');
  assert.strictEqual(parseInt(partialCount.rows[0].count), KILL_AFTER_BATCH * BATCH_SIZE);
  console.log(`  ✅ Partial state: ${partialCount.rows[0].count} rows (correct)`);

  // Phase 2: Resume from checkpoint
  console.log('\n  ▶ Resuming from checkpoint...\n');

  const cp = await pgClient.query(
    `SELECT last_mongo_id, inserted_count FROM migration.checkpoints
     WHERE source_db = $1 AND collection_name = $2`,
    [SOURCE_DB, TEST_COLLECTION]
  );
  let resumeFromId: ObjectId = new ObjectId(cp.rows[0].last_mongo_id);
  let resumeInserted = parseInt(cp.rows[0].inserted_count);
  let resumeBatch = KILL_AFTER_BATCH;

  let hasMore = true;
  while (hasMore) {
    const query = { _id: { $gt: resumeFromId } };
    const batchDocs = await db.collection(TEST_COLLECTION)
      .find(query).sort({ _id: 1 }).limit(BATCH_SIZE).toArray();

    if (batchDocs.length === 0) { hasMore = false; break; }

    resumeBatch++;
    const client = await pool.connect();
    await client.query('BEGIN');
    let inserted = 0;
    for (const doc of batchDocs) {
      const r = await client.query(
        `INSERT INTO migration.gate2_test (legacy_mongo_id, value, name)
         VALUES ($1, $2, $3) ON CONFLICT (legacy_mongo_id) DO NOTHING`,
        [doc._id.toString(), doc.value, doc.name]
      );
      inserted += r.rowCount || 0;
    }
    await client.query('COMMIT');
    client.release();

    resumeInserted += inserted;
    resumeFromId = batchDocs[batchDocs.length - 1]._id;
    console.log(`  Batch ${resumeBatch}: ${batchDocs.length} docs, ${inserted} new (total: ${resumeInserted})`);

    if (batchDocs.length < BATCH_SIZE) hasMore = false;
  }

  // Verify final state
  const finalCount = await pgClient.query('SELECT COUNT(*) FROM migration.gate2_test');
  const pgCount = parseInt(finalCount.rows[0].count);
  console.log(`\n  Mongo source:  ${TOTAL_DOCS}`);
  console.log(`  PG final:      ${pgCount}`);
  assert.strictEqual(pgCount, TOTAL_DOCS);
  console.log(`  ✅ Count match: ${pgCount} = ${TOTAL_DOCS}`);

  // No duplicates
  const dups = await pgClient.query(
    `SELECT legacy_mongo_id, COUNT(*) FROM migration.gate2_test GROUP BY legacy_mongo_id HAVING COUNT(*) > 1`
  );
  assert.strictEqual(dups.rows.length, 0);
  console.log(`  ✅ No duplicates`);

  // Financial sum
  const mongoSum = docs.reduce((s, d) => s + d.value, 0);
  const pgSum = parseFloat((await pgClient.query('SELECT SUM(value) FROM migration.gate2_test')).rows[0].sum);
  assert.ok(Math.abs(mongoSum - pgSum) < 0.01);
  console.log(`  ✅ Sum match: ₹${pgSum}`);

  // Cleanup
  await db.collection(TEST_COLLECTION).drop();
  await pgClient.query('DROP TABLE migration.gate2_test');
  await pgClient.query(`DELETE FROM migration.checkpoints WHERE source_db = $1 AND collection_name = $2`, [SOURCE_DB, TEST_COLLECTION]);

  await pool.end();
  await pgClient.end();
  await mongo.close();

  console.log('\n═══ Gate 2: PASS ═══\n');
};

main().catch(err => {
  console.error('\n═══ Gate 2: FAIL ═══');
  console.error(err);
  process.exit(1);
});
