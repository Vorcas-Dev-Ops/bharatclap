import { getDb } from '../config/db';
import { WalletRepository } from '../repositories/walletRepository';

/**
 * Idempotent release of a wallet hold placed during dispatch.
 *
 * The hold is a type='hold' deduction in wallet_transactions with
 * reference_type='booking_lead_fee' and reference_id=bookingId.
 *
 * Release = type='release' credit for the same amount. Idempotent:
 * returns early if a release or deduction already exists for this
 * provider+booking pair (deduction means the provider accepted and
 * the hold was consumed, so nothing to release).
 */
export const releaseHoldForBooking = async (
  providerId: string,
  bookingId: string
): Promise<{ released: boolean; amount: number }> => {
  const db = getDb();
  const bkRef = String(bookingId);

  // 1. Check if a release or deduction already exists — nothing to do
  const existing = await db.query(
    `SELECT id FROM provider.wallet_transactions
     WHERE provider_id::text = $1
       AND reference_id = $2
       AND type IN ('release', 'deduction')
     LIMIT 1`,
    [providerId, bkRef]
  );
  if (existing.rows.length > 0) {
    return { released: false, amount: 0 };
  }

  // 2. Find the original hold to know the amount
  const holdRes = await db.query(
    `SELECT amount FROM provider.wallet_transactions
     WHERE provider_id::text = $1
       AND reference_id = $2
       AND type = 'hold'
       AND reference_type = 'booking_lead_fee'
     LIMIT 1`,
    [providerId, bkRef]
  );
  if (holdRes.rows.length === 0) {
    // No hold was ever placed — nothing to release
    return { released: false, amount: 0 };
  }

  const holdAmount = Number(holdRes.rows[0].amount);
  if (holdAmount <= 0) {
    return { released: false, amount: 0 };
  }

  // 3. Credit the wallet via the same atomic ledger mechanism
  // ponytail: recordTransaction is already ACID with fencing token and hash chain
  await WalletRepository.recordTransaction({
    providerId,
    type: 'release',
    amount: holdAmount,
    referenceType: 'booking_lead_fee',
    referenceId: bkRef,
    description: `Release lead fee hold for booking #${bkRef}`,
  });

  return { released: true, amount: holdAmount };
};
