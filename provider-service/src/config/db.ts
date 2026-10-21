import { Pool } from 'pg';
import { createPgPool } from '@bharatclap/shared';

let pool: Pool;

export const connectDB = async (retries = 5, delayMs = 1500): Promise<Pool> => {
  if (!pool) {
    const rawConn = process.env.PG_URI || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/bharatclap_migration_test';
    const connectionString = rawConn.replace('@localhost:', '@127.0.0.1:');
    pool = createPgPool({ connectionString });
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      const res = await client.query('SELECT current_database() AS db');
      client.release();
      console.log(`[PROVIDER-SERVICE] ✅ PostgreSQL Connected: ${res.rows[0].db}`);
      return pool;
    } catch (error: any) {
      if (attempt === retries) {
        console.error(`[PROVIDER-SERVICE] ❌ PostgreSQL Connection Error: ${error.message}`);
        throw error;
      }
      console.warn(`[PROVIDER-SERVICE] ⚠️ PostgreSQL connection attempt ${attempt}/${retries} failed (${error.message}). Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return pool;
};

export const getDb = (): Pool => {
  if (!pool) {
    const connectionString = process.env.PG_URI || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
    pool = createPgPool({ connectionString });
  }
  return pool;
};

export const verifyTransactionCapability = async (): Promise<boolean> => {
  try {
    const db = getDb();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT 1');
      await client.query('COMMIT');
      console.log('[PROVIDER-SERVICE] ✅ PostgreSQL ACID Transaction capability verified.');
      return true;
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(`[PROVIDER-SERVICE] ❌ Transaction check failed: ${err.message}`);
    return false;
  }
};
