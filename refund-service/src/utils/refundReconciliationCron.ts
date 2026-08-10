import { Refund } from '../models/Refund';
import { logger } from '@bharatclap/shared';
import { processRazorpayRefund } from '../services/razorpayRefundService';

export const runRefundReconciliationCron = async (): Promise<void> => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find refunds stuck in PENDING_GATEWAY or RETRYING > 30 mins
    const staleRefunds = await Refund.find({
      status: { $in: ['PENDING_GATEWAY', 'RETRYING', 'REQUESTED'] },
      updatedAt: { $lte: thirtyMinutesAgo },
      payoutAttempts: { $lt: 3 }
    }).limit(50);

    if (staleRefunds.length === 0) {
      return;
    }

    logger.info(`Refund reconciliation cron found ${staleRefunds.length} stale refunds`, {
      service: 'refund-service',
      action: 'REFUND_RECONCILIATION_CRON_START'
    });

    for (const refund of staleRefunds) {
      try {
        await processRazorpayRefund(refund._id.toString());
      } catch (err: any) {
        logger.warn(`Refund reconciliation retry failed for refund ${refund._id}`, {
          metadata: { err: err?.message }
        });
      }
    }
  } catch (err: any) {
    logger.error('Refund reconciliation cron error', err);
  }
};
