import { getDb } from '../config/db';

let isRunning = false;

export const runHashChainVerification = async (): Promise<void> => {
  if (isRunning) return;
  isRunning = true;

  try {
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pool = getDb();

    const activeRes = await pool.query(
      `SELECT DISTINCT provider_id FROM provider.wallet_transactions
       WHERE created_at >= $1`,
      [recentCutoff]
    );

    if (activeRes.rows.length === 0) {
      console.log('[HASH-CHAIN] No providers with recent transactions. Skipping.');
      return;
    }

    const activeProviderIds = activeRes.rows.map(r => r.provider_id);
    console.log(`[HASH-CHAIN] Verifying ${activeProviderIds.length} providers with recent transactions...`);

    let totalBroken = 0;

    for (const providerId of activeProviderIds) {
      const txRes = await pool.query(
        `SELECT id, provider_id, type, amount, balance_after, reference_id, previous_hash, current_hash, created_at
         FROM provider.wallet_transactions
         WHERE provider_id = $1
         ORDER BY created_at ASC`,
        [providerId]
      );

      const transactions = txRes.rows;
      if (transactions.length === 0) continue;

      let expectedPreviousHash = 'GENESIS_HASH';
      let chainBroken = false;

      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];

        // First transaction may have 'GENESIS_HASH' or null
        if (i === 0) {
          expectedPreviousHash = tx.current_hash;
          continue;
        }

        if (tx.previous_hash && tx.previous_hash !== expectedPreviousHash) {
          console.error(
            `[HASH-CHAIN BREAK] Provider ${providerId} | Transaction ${tx.id} (index ${i}) | ` +
            `Expected previous_hash="${expectedPreviousHash}" but got "${tx.previous_hash}"`
          );
          chainBroken = true;
          totalBroken++;
          break;
        }

        if (tx.current_hash) {
          expectedPreviousHash = tx.current_hash;
        }
      }
    }

    if (totalBroken > 0) {
      console.error(`[HASH-CHAIN] ❌ ${totalBroken} provider(s) have broken hash chains. Investigate immediately.`);
    } else {
      console.log(`[HASH-CHAIN] ✅ All ${activeProviderIds.length} providers passed hash chain verification.`);
    }
  } catch (err: any) {
    console.error(`[HASH-CHAIN ERROR] Verification failed: ${err.message}`);
  } finally {
    isRunning = false;
  }
};

export const startHashChainVerificationCron = () => {
  // Run on startup after 60s, then daily
  setTimeout(runHashChainVerification, 60000);
  setInterval(runHashChainVerification, 24 * 60 * 60 * 1000);
};

