import { getDb } from '../config/db';

/**
 * Periodically purges abandoned pending orders (>24 hours old).
 * Preserves all 'paid' and fulfilled orders permanently for financial audit and compliance.
 */
export const cleanStalePendingOrders = async (): Promise<number> => {
  try {
    const db = getDb();
    const res = await db.query(`
      DELETE FROM provider.provider_orders
      WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '24 hours'
      RETURNING id
    `);
    const count = res.rowCount || 0;
    if (count > 0) {
      console.log(`[ORDER CLEANUP] Purged ${count} abandoned pending order(s) older than 24h.`);
    }
    return count;
  } catch (err: any) {
    console.error('[ORDER CLEANUP ERROR] Failed to clean stale pending orders:', err.message);
    return 0;
  }
};

export const startOrderCleanupCron = (): void => {
  // Run once on startup after 30 seconds
  setTimeout(cleanStalePendingOrders, 30_000);

  // Run every 6 hours
  setInterval(cleanStalePendingOrders, 6 * 60 * 60 * 1000);
};
