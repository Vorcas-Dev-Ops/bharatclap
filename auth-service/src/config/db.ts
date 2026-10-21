import { getPgPool } from '@bharatclap/shared';
import { Pool } from 'pg';

let pool: Pool;

export const connectDB = async (retries = 5, delayMs = 1500): Promise<Pool> => {
  pool = getPgPool();
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await pool.query('SELECT current_database(), version();');
      console.log(`[AUTH-SERVICE] ✅ PostgreSQL Connected: ${res.rows[0].current_database}`);
      return pool;
    } catch (error: any) {
      if (attempt === retries) {
        console.error(`[AUTH-SERVICE] ❌ PostgreSQL Connection Error: ${error.message}`);
        throw error;
      }
      console.warn(`[AUTH-SERVICE] ⚠️ PostgreSQL connection attempt ${attempt}/${retries} failed (${error.message}). Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return pool;
};

export const getDb = (): Pool => {
  if (!pool) {
    pool = getPgPool();
  }
  return pool;
};
