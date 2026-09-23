/**
 * P0-3: Canonical decimal representation for hash chain integrity.
 *
 * Problem: JavaScript Number produces inconsistent string forms
 * (100, 100.0, 1e2) which breaks hash chain determinism.
 *
 * Solution: All monetary amounts pass through canonicalDecimal()
 * before hashing. NUMERIC(12,2) in PG always stores exactly 2
 * decimal places, so we mirror that here.
 *
 * Rule: 100 → "100.00", 0 → "0.00", 99.5 → "99.50"
 */

/**
 * Returns a deterministic 2-decimal-place string for any numeric input.
 * This is the ONLY representation that may enter a hash chain.
 */
export const canonicalDecimal = (value: number | string): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) {
    throw new Error(`canonicalDecimal: invalid input "${value}"`);
  }
  return n.toFixed(2);
};

/**
 * Computes the SHA-256 hash for a wallet transaction using canonical decimals.
 *
 * Hash input format:
 *   previous_hash:provider_id:type:amount:balance_after:reference_id:timestamp_iso
 *
 * Every numeric field is canonicalized before hashing.
 */
export const computeWalletHash = (params: {
  previousHash: string;
  providerId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceId: string;
  timestampIso: string;
}): string => {
  // ponytail: inline crypto import — no new dependency
  const crypto = require('crypto') as typeof import('crypto');

  const input = [
    params.previousHash,
    params.providerId,
    params.type,
    canonicalDecimal(params.amount),
    canonicalDecimal(params.balanceAfter),
    params.referenceId,
    params.timestampIso,
  ].join(':');

  return crypto.createHash('sha256').update(input).digest('hex');
};

/**
 * Verifies a single transaction's hash against its inputs.
 * Returns true if the hash matches, false if tampered.
 */
export const verifyTransactionHash = (tx: {
  previous_hash: string;
  provider_id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceId: string;
  createdAt: string | Date;
  current_hash: string;
}): boolean => {
  const expected = computeWalletHash({
    previousHash: tx.previous_hash,
    providerId: String(tx.provider_id),
    type: tx.type,
    amount: tx.amount,
    balanceAfter: tx.balanceAfter,
    referenceId: tx.referenceId,
    timestampIso: typeof tx.createdAt === 'string' ? tx.createdAt : tx.createdAt.toISOString(),
  });
  return expected === tx.current_hash;
};
