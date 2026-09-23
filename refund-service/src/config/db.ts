import { Pool } from 'pg';
import { createPgPool } from '@bharatclap/shared';

let pool: Pool;

export const connectDB = async (): Promise<Pool> => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.PG_URI || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
    pool = createPgPool({ connectionString });
  }
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT current_database() AS db');
    client.release();
    console.log(`[REFUND-SERVICE] ✅ PostgreSQL Connected: ${res.rows[0].db}`);
  } catch (error: any) {
    console.error(`[REFUND-SERVICE] ❌ PostgreSQL Connection Error: ${error.message}`);
    throw error;
  }
  return pool;
};

export const getDb = (): Pool => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.PG_URI || 'postgresql://postgres:postgres@localhost:5432/bharatclap_migration_test';
    pool = createPgPool({ connectionString });
  }
  return pool;
};
