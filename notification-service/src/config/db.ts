import { Pool } from 'pg';
import { createPgPool } from '@bharatclap/shared';

let pool: Pool;

export const connectDB = async (retries = 3, delayMs = 1500): Promise<Pool> => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.PG_URI || 'postgresql://postgres:postgres@127.0.0.1:5432/bharatclap_migration_test';
    pool = createPgPool({ connectionString });
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      const res = await client.query('SELECT current_database() AS db');
      client.release();
      console.log(`[NOTIFICATION-SERVICE] ✅ PostgreSQL Connected: ${res.rows[0].db}`);
      return pool;
    } catch (error: any) {
      if (attempt === retries) {
        console.error(`[NOTIFICATION-SERVICE] ❌ PostgreSQL Connection Error: ${error.message}`);
        throw error;
      }
      console.warn(`[NOTIFICATION-SERVICE] ⚠️ PostgreSQL connection attempt ${attempt}/${retries} failed (${error.message}). Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return pool;
};

export const getDb = (): Pool => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.PG_URI || 'postgresql://postgres:postgres@127.0.0.1:5432/bharatclap_migration_test';
    pool = createPgPool({ connectionString });
  }
  return pool;
};
