import { Pool } from 'pg';
import { createPgPool } from '@bharatclap/shared';

let pool: Pool;

export const connectDB = async (): Promise<Pool> => {
  if (!pool) {
    const connectionString = process.env.PG_URI || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
    pool = createPgPool({ connectionString });
  }
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT current_database() AS db');
    client.release();
    console.log(`[BOOKING-SERVICE] ✅ PostgreSQL Connected: ${res.rows[0].db}`);
  } catch (error: any) {
    console.error(`[BOOKING-SERVICE] ❌ PostgreSQL Connection Error: ${error.message}`);
    throw error;
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
      console.log('[BOOKING-SERVICE] ✅ PostgreSQL ACID Transaction capability verified.');
      return true;
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(`[BOOKING-SERVICE] ❌ Transaction check failed: ${err.message}`);
    return false;
  }
};
