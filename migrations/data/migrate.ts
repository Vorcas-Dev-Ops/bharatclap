/**
 * Mongo → PostgreSQL Batch Migration Framework
 *
 * Usage:
 *   npx tsx migrations/data/migrate.ts --collection users --batch-size 1000
 *   npx tsx migrations/data/migrate.ts --collection users --resume
 *   npx tsx migrations/data/migrate.ts --collection users --reconcile
 *
 * Features:
 *   - Batched reads from MongoDB (configurable batch size)
 *   - Transform per collection (Mongo document → PG row)
 *   - Checkpoint after each batch (resume from failure point)
 *   - Per-batch transaction (not one giant transaction)
 *   - Financial reconciliation (count + sum)
 *   - legacy_mongo_id stored for every row
 */
import { MongoClient, Db, Collection as MongoCollection, ObjectId } from 'mongodb';
import { Client, Pool } from 'pg';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bharatclap';
const PG_URL = process.env.DATABASE_URL || process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
const DEFAULT_BATCH_SIZE = 1000;

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface MigrationCheckpoint {
  collection_name: string;
  last_id: string;
  rows_migrated: number;
  batch_number: number;
  status: 'in_progress' | 'completed' | 'failed';
  error_message?: string;
  started_at: Date;
  updated_at: Date;
}

interface CollectionConfig {
  mongoCollection: string;
  pgSchema: string;
  pgTable: string;
  /** Transform a Mongo document into a PG row (key-value object) */
  transform: (doc: any) => Record<string, any>;
  /** Column names for INSERT (must match transform keys) */
  columns: string[];
  /** Financial columns to reconcile (sum these after migration) */
  reconcileColumns?: string[];
  /** Sort field for deterministic ordering */
  sortField?: string;
}

// ═══════════════════════════════════════════════════════════════════
// Collection Configs (add one per collection to migrate)
// ═══════════════════════════════════════════════════════════════════

const COLLECTION_CONFIGS: Record<string, CollectionConfig> = {
  users: {
    mongoCollection: 'users',
    pgSchema: 'auth',
    pgTable: 'users',
    sortField: '_id',
    columns: ['id', 'legacy_mongo_id', 'name', 'email', 'phone', 'role', 'created_at', 'updated_at'],
    transform: (doc) => ({
      id: crypto.randomUUID(),
      legacy_mongo_id: doc._id.toString(),
      name: doc.name || '',
      email: doc.email || null,
      phone: doc.phone || null,
      role: doc.role || 'customer',
      created_at: doc.createdAt || new Date(),
      updated_at: doc.updatedAt || new Date(),
    }),
  },
  // ponytail: Add more collections as needed. Each follows the same pattern:
  // mongoCollection, pgSchema, pgTable, columns[], transform(doc), reconcileColumns[]
};

// ═══════════════════════════════════════════════════════════════════
// Core Migration Logic
// ═══════════════════════════════════════════════════════════════════

const getCheckpoint = async (pgClient: Client, collection: string): Promise<MigrationCheckpoint | null> => {
  const result = await pgClient.query(
    `SELECT * FROM migration.checkpoints WHERE collection_name = $1 ORDER BY updated_at DESC LIMIT 1`,
    [collection]
  );
  return result.rows[0] || null;
};

const saveCheckpoint = async (pgClient: Client, cp: MigrationCheckpoint): Promise<void> => {
  await pgClient.query(
    `INSERT INTO migration.checkpoints (collection_name, last_id, rows_migrated, batch_number, status, error_message, started_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (collection_name) DO UPDATE SET
       last_id = $2, rows_migrated = $3, batch_number = $4, status = $5, error_message = $6, updated_at = NOW()`,
    [cp.collection_name, cp.last_id, cp.rows_migrated, cp.batch_number, cp.status, cp.error_message || null, cp.started_at]
  );
};

const buildInsertSQL = (config: CollectionConfig): string => {
  const cols = config.columns.map(c => `"${c}"`).join(', ');
  const placeholders = config.columns.map((_, i) => `$${i + 1}`).join(', ');
  return `INSERT INTO ${config.pgSchema}.${config.pgTable} (${cols}) VALUES (${placeholders})
          ON CONFLICT (legacy_mongo_id) DO NOTHING`;
};

const migrateBatch = async (
  pgPool: Pool,
  config: CollectionConfig,
  docs: any[],
): Promise<number> => {
  const client = await pgPool.connect();
  let inserted = 0;

  try {
    await client.query('BEGIN');
    const sql = buildInsertSQL(config);

    for (const doc of docs) {
      const row = config.transform(doc);
      const values = config.columns.map(col => row[col]);

      try {
        const result = await client.query(sql, values);
        inserted += result.rowCount || 0;
      } catch (err: any) {
        // Log but continue — ON CONFLICT handles duplicates
        if (err.code !== '23505') { // not a unique violation
          console.error(`  ⚠ Row error (mongo_id=${doc._id}): ${err.message}`);
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return inserted;
};

// ═══════════════════════════════════════════════════════════════════
// Financial Reconciliation
// ═══════════════════════════════════════════════════════════════════

const reconcile = async (
  mongoDb: Db,
  pgClient: Client,
  config: CollectionConfig,
): Promise<void> => {
  console.log(`\n═══ Reconciliation: ${config.mongoCollection} → ${config.pgSchema}.${config.pgTable} ═══`);

  // Count comparison
  const mongoCount = await mongoDb.collection(config.mongoCollection).countDocuments();
  const pgResult = await pgClient.query(`SELECT COUNT(*) FROM ${config.pgSchema}.${config.pgTable}`);
  const pgCount = parseInt(pgResult.rows[0].count, 10);

  console.log(`  Mongo count:  ${mongoCount}`);
  console.log(`  PG count:     ${pgCount}`);
  console.log(`  Match:        ${mongoCount === pgCount ? '✅' : '❌ MISMATCH'}`);

  // Sum comparison for financial columns
  if (config.reconcileColumns && config.reconcileColumns.length > 0) {
    for (const col of config.reconcileColumns) {
      // Mongo sum
      const mongoAgg = await mongoDb.collection(config.mongoCollection).aggregate([
        { $group: { _id: null, total: { $sum: `$${col}` } } }
      ]).toArray();
      const mongoSum = mongoAgg[0]?.total || 0;

      // PG sum
      const pgSumResult = await pgClient.query(
        `SELECT COALESCE(SUM("${col}"), 0) AS total FROM ${config.pgSchema}.${config.pgTable}`
      );
      const pgSum = parseFloat(pgSumResult.rows[0].total);

      console.log(`  ${col}:`);
      console.log(`    Mongo sum: ${mongoSum}`);
      console.log(`    PG sum:    ${pgSum}`);
      console.log(`    Match:     ${Math.abs(mongoSum - pgSum) < 0.01 ? '✅' : '❌ MISMATCH'}`);
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════

const main = async () => {
  const args = process.argv.slice(2);
  const collectionIdx = args.indexOf('--collection');
  const collectionName = collectionIdx >= 0 ? args[collectionIdx + 1] : null;
  const batchSizeIdx = args.indexOf('--batch-size');
  const batchSize = batchSizeIdx >= 0 ? parseInt(args[batchSizeIdx + 1], 10) : DEFAULT_BATCH_SIZE;
  const isResume = args.includes('--resume');
  const isReconcile = args.includes('--reconcile');

  if (!collectionName || !COLLECTION_CONFIGS[collectionName]) {
    console.error(`Usage: npx tsx migrate.ts --collection <name> [--batch-size N] [--resume] [--reconcile]`);
    console.error(`Available collections: ${Object.keys(COLLECTION_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  const config = COLLECTION_CONFIGS[collectionName];

  // Connect to both databases
  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const mongoDb = mongoClient.db();

  const pgPool = new Pool({ connectionString: PG_URL, max: 5 });
  const pgClient = new Client({ connectionString: PG_URL });
  await pgClient.connect();

  console.log(`\n═══ BharatClap Data Migration ═══`);
  console.log(`Collection: ${collectionName}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Mode: ${isReconcile ? 'RECONCILE ONLY' : isResume ? 'RESUME' : 'FRESH START'}\n`);

  try {
    // Reconcile-only mode
    if (isReconcile) {
      await reconcile(mongoDb, pgClient, config);
      return;
    }

    // Check for existing checkpoint
    const checkpoint = await getCheckpoint(pgClient, collectionName);

    let lastId: ObjectId | null = null;
    let totalMigrated = 0;
    let batchNumber = 0;

    if (isResume && checkpoint && checkpoint.status !== 'completed') {
      lastId = new ObjectId(checkpoint.last_id);
      totalMigrated = checkpoint.rows_migrated;
      batchNumber = checkpoint.batch_number;
      console.log(`Resuming from batch ${batchNumber}, last_id=${lastId}, migrated=${totalMigrated}`);
    } else if (checkpoint && checkpoint.status === 'completed') {
      console.log(`✅ Collection "${collectionName}" already completed (${checkpoint.rows_migrated} rows).`);
      console.log(`   Run with --reconcile to verify, or delete the checkpoint to re-migrate.`);
      return;
    }

    const startedAt = new Date();
    const mongoCollection = mongoDb.collection(config.mongoCollection);
    const sortField = config.sortField || '_id';

    // Batch loop
    let hasMore = true;
    while (hasMore) {
      const query: any = lastId ? { _id: { $gt: lastId } } : {};
      const docs = await mongoCollection
        .find(query)
        .sort({ [sortField]: 1 })
        .limit(batchSize)
        .toArray();

      if (docs.length === 0) {
        hasMore = false;
        break;
      }

      batchNumber++;
      console.log(`  Batch ${batchNumber}: ${docs.length} documents...`);

      const inserted = await migrateBatch(pgPool, config, docs);
      totalMigrated += inserted;
      lastId = docs[docs.length - 1]._id;

      // Checkpoint
      await saveCheckpoint(pgClient, {
        collection_name: collectionName,
        last_id: lastId.toString(),
        rows_migrated: totalMigrated,
        batch_number: batchNumber,
        status: 'in_progress',
        started_at: startedAt,
        updated_at: new Date(),
      });

      console.log(`    ✅ Inserted ${inserted}, total ${totalMigrated}, checkpoint saved.`);

      if (docs.length < batchSize) {
        hasMore = false;
      }
    }

    // Mark completed
    await saveCheckpoint(pgClient, {
      collection_name: collectionName,
      last_id: lastId?.toString() || '',
      rows_migrated: totalMigrated,
      batch_number: batchNumber,
      status: 'completed',
      started_at: startedAt,
      updated_at: new Date(),
    });

    console.log(`\n✅ Migration completed: ${totalMigrated} rows in ${batchNumber} batches.`);

    // Auto-reconcile
    await reconcile(mongoDb, pgClient, config);

  } catch (err: any) {
    console.error(`\n❌ Migration failed: ${err.message}`);

    // Save failure checkpoint
    await saveCheckpoint(pgClient, {
      collection_name: collectionName,
      last_id: '',
      rows_migrated: 0,
      batch_number: 0,
      status: 'failed',
      error_message: err.message,
      started_at: new Date(),
      updated_at: new Date(),
    }).catch(() => {});

    process.exit(1);
  } finally {
    await pgPool.end();
    await pgClient.end();
    await mongoClient.close();
  }
};

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
