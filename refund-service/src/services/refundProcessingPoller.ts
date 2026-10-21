import { getDb } from '../config/db';
import { processRazorpayRefund } from './razorpayRefundService';
import { logger } from '@bharatclap/shared';

const MAX_ATTEMPTS = 5;
let isProcessing = false;

/**
 * Refund Processing Poller
 * Picks up refunds in REQUESTED status and calls Razorpay to initiate them.
 * The existing razorpayRefundService.processRazorpayRefund handles the actual API call.
 *
 * ponytail: This is the missing link — refunds were created with REQUESTED status
 * but nothing was wired to actually call Razorpay. This poller closes that gap.
 */
export const processRequestedRefunds = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pool = getDb();

    // Claim up to 5 REQUESTED (or crashed PROCESSING) refunds atomically
    const pending = await pool.query(
      `UPDATE payment.refunds
       SET status = 'PROCESSING', updated_at = NOW(), version = COALESCE(version, 0) + 1
       WHERE id IN (
         SELECT id FROM payment.refunds
         WHERE (
           status = 'REQUESTED'
           OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '5 minutes')
         )
           AND (version IS NULL OR version < $1)
         ORDER BY created_at
         LIMIT 5
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id`,
      [MAX_ATTEMPTS]
    );

    for (const row of pending.rows) {
      try {
        await processRazorpayRefund(String(row.id));
        logger.info('Refund processed successfully', {
          service: 'refund-service',
          action: 'REFUND_PROCESSED',
          metadata: { refundId: String(row.id) }
        });
      } catch (err: any) {
        // processRazorpayRefund already sets status to FAILED on error
        logger.error('Refund processing failed', err, {
          service: 'refund-service',
          action: 'REFUND_PROCESSING_FAILED',
          metadata: { refundId: String(row.id) }
        });
      }
    }
  } catch (err: any) {
    logger.error('Refund processing poller error', err, {
      service: 'refund-service',
      action: 'REFUND_POLLER_ERROR'
    });
  } finally {
    isProcessing = false;
  }
};

export const startRefundProcessingPoller = () => {
  // ponytail: delay first run 10s to let DB connections settle
  setTimeout(processRequestedRefunds, 10_000);
  const interval = setInterval(processRequestedRefunds, 30_000);
  return interval;
};
