import { getDb } from '../config/db';
import { logger } from '@bharatclap/shared';
import { processRazorpayRefund } from '../services/razorpayRefundService';

export const runRefundReconciliationCron = async (): Promise<void> => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const pool = getDb();

    // Find refunds stuck in PENDING_GATEWAY or REQUESTED > 30 mins
    const staleRefundsRes = await pool.query(
      `SELECT id FROM payment.refunds
       WHERE status IN ('PENDING_GATEWAY', 'REQUESTED')
         AND updated_at <= $1
       LIMIT 50`,
      [thirtyMinutesAgo]
    );

    if (staleRefundsRes.rows.length === 0) {
      return;
    }

    logger.info(`Refund reconciliation cron found ${staleRefundsRes.rows.length} stale refunds`, {
      service: 'refund-service',
      action: 'REFUND_RECONCILIATION_CRON_START'
    });

    for (const refund of staleRefundsRes.rows) {
      try {
        await processRazorpayRefund(String(refund.id));
      } catch (err: any) {
        logger.warn(`Refund reconciliation retry failed for refund ${refund.id}`, {
          metadata: { err: err?.message }
        });
      }
    }
  } catch (err: any) {
    logger.error('Refund reconciliation cron error', err);
  }
};
