/**
 * PostgreSQL Error Classification
 *
 * Distinguishes retryable from non-retryable PG errors so the application
 * can safely retry transient failures without looping on logic errors.
 *
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

/** SQLSTATE codes that are safe to retry (transient / contention) */
const RETRYABLE_CODES = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '55P03', // lock_not_available (if using NOWAIT)
]);

/** SQLSTATE codes that must NOT be retried (logic / constraint errors) */
const NON_RETRYABLE_CODES = new Set([
  '23502', // not_null_violation
  '23503', // foreign_key_violation
  '23505', // unique_violation
  '23514', // check_violation
  '22000', // data_exception (general)
  '22003', // numeric_value_out_of_range
  '22P02', // invalid_text_representation
  '42000', // syntax_error_or_access_rule_violation
  '42501', // insufficient_privilege
  '42P01', // undefined_table
]);

export interface PgErrorInfo {
  /** Original error */
  error: any;
  /** PostgreSQL SQLSTATE code (e.g. '23505') */
  code: string;
  /** Whether the operation can be safely retried */
  retryable: boolean;
  /** Human-readable classification */
  category: 'serialization' | 'deadlock' | 'connection' | 'constraint' | 'permission' | 'syntax' | 'unknown';
  /** Suggested action */
  action: 'retry' | 'abort' | 'alert';
}

/**
 * Classifies a PostgreSQL error for retry/abort decisions.
 *
 * Usage:
 *   try { await pool.query(...) }
 *   catch (err) {
 *     const info = classifyPgError(err);
 *     if (info.retryable) { /* retry with backoff * / }
 *     else { /* abort, log, respond with error * / }
 *   }
 */
export const classifyPgError = (err: any): PgErrorInfo => {
  const code: string = err?.code || '';

  if (RETRYABLE_CODES.has(code)) {
    let category: PgErrorInfo['category'] = 'unknown';
    if (code === '40001') category = 'serialization';
    else if (code === '40P01') category = 'deadlock';
    else category = 'connection';

    return { error: err, code, retryable: true, category, action: 'retry' };
  }

  if (NON_RETRYABLE_CODES.has(code)) {
    let category: PgErrorInfo['category'] = 'constraint';
    if (code === '42501') category = 'permission';
    else if (code.startsWith('42')) category = 'syntax';

    return { error: err, code, retryable: false, category, action: 'abort' };
  }

  // Statement timeout (57014) — retryable but should alert
  if (code === '57014') {
    return { error: err, code, retryable: true, category: 'unknown', action: 'alert' };
  }

  // Unknown SQLSTATE — default to non-retryable to avoid infinite loops
  return { error: err, code, retryable: false, category: 'unknown', action: 'alert' };
};

/**
 * Retries a function up to maxRetries times on retryable PG errors.
 * Uses exponential backoff with jitter.
 *
 * Non-retryable errors are thrown immediately.
 */
export const withPgRetry = async <T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelayMs?: number; onRetry?: (info: PgErrorInfo, attempt: number) => void } = {}
): Promise<T> => {
  const { maxRetries = 3, baseDelayMs = 100, onRetry } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const info = classifyPgError(err);

      if (!info.retryable || attempt >= maxRetries) {
        throw err;
      }

      onRetry?.(info, attempt + 1);

      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * baseDelayMs;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // ponytail: unreachable, but TypeScript needs it
  throw new Error('withPgRetry: unreachable');
};
