import { Pool, PoolClient } from 'pg';
import { withPgRetry } from '../utils/pgErrors';

export interface TransactionOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

/**
 * Execute an atomic transaction against PostgreSQL with automatic retry
 * on transient retryable errors (e.g. serialization failure 40001, deadlock 40P01).
 *
 * All operations inside `fn` share the same client and transaction boundary.
 */
export const withTransaction = async <T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
  opts: TransactionOptions = {}
): Promise<T> => {
  return withPgRetry(
    async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          // Ignore rollback failure if connection died
        }
        throw err;
      } finally {
        client.release();
      }
    },
    { maxRetries: opts.maxRetries ?? 3, baseDelayMs: opts.baseDelayMs ?? 100 }
  );
};
