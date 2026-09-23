import { getPgPool } from '@bharatclap/shared';
import { Pool } from 'pg';

let pool: Pool;

export const connectDB = async (): Promise<Pool> => {
  pool = getPgPool();
  try {
    const res = await pool.query('SELECT current_database(), version();');
    console.log(`[AUTH-SERVICE] ✅ PostgreSQL Connected: ${res.rows[0].current_database}`);
    return pool;
  } catch (error: any) {
    console.error(`[AUTH-SERVICE] ❌ PostgreSQL Connection Error: ${error.message}`);
    throw error;
  }
};

export const getDb = (): Pool => {
  if (!pool) {
    pool = getPgPool();
  }
  return pool;
};
