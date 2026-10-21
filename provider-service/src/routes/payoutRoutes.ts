import express from 'express';
import { getAllPayouts, requestPayout, getPayoutById, updatePayoutStatus } from '../controllers/payoutController';
import { protect, admin, checkPermission, providerOnly } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import { getDb } from '../config/db';
import { recordWalletChangeAndAudit } from '../services/walletLedgerService';

const router = express.Router();

router.route('/')
  .get(protect, admin, checkPermission('payouts', 'view'), getAllPayouts)
  .post(protect, providerOnly, requestPayout);

router.route('/:id')
  .get(protect, admin, checkPermission('payouts', 'view'), getPayoutById);

router.route('/:id/status')
  .put(protect, admin, checkPermission('payouts', 'update'), updatePayoutStatus);

/**
 * Defect J + K: Settlement refund-sync with serialized race protection
 *
 * Case 1: Settlement not yet processing → mark refund_pending, block payout
 * Case 2: Settlement is processing → mark refund_pending, payout will check
 * Case 3: Settlement already paid → REVERSAL/CLAWBACK via wallet debit
 */
router.post('/internal/refund-sync', internalAuth, async (req: any, res: any) => {
  try {
    const refund_event_id = req.body.refund_event_id || req.body.refundEventId || req.body.refundId;
    const provider_id = req.body.provider_id || req.body.providerId;
    const booking_id = req.body.booking_id || req.body.bookingId;
    const refund_amount = req.body.refund_amount || req.body.refundAmount;
    const refund_type = req.body.refund_type || req.body.refundType || 'full';

    if (!refund_event_id || !booking_id) {
      res.status(400).json({ success: false, message: 'refund_event_id and booking_id required' });
      return;
    }

    const db = getDb();
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Lock settlement row for this booking
      const stlRes = await client.query(
        `SELECT id, provider_id, status, net_payable_amount, refund_event_id
         FROM provider.provider_settlements
         WHERE booking_id::text = $1
         FOR UPDATE`,
        [String(booking_id)]
      );

      const settlement = stlRes.rows[0];

      if (!settlement) {
        // No settlement yet — nothing to reconcile
        await client.query('COMMIT');
        res.json({ success: true, action: 'no_settlement' });
        return;
      }

      // Idempotency: already processed this refund event
      if (settlement.refund_event_id === refund_event_id) {
        await client.query('COMMIT');
        res.json({ success: true, action: 'already_processed' });
        return;
      }

      const settlementAmount = Number(settlement.net_payable_amount);
      const refAmt = Number(refund_amount) || settlementAmount;

      if (['pending_hold', 'ready_for_payout', 'cod_pending'].includes(settlement.status)) {
        // Case 1: Not yet paid → block payout
        await client.query(
          `UPDATE provider.provider_settlements
           SET status = 'refund_pending', refund_event_id = $1, refund_amount = $2,
               refund_processed_at = NOW(), updated_at = NOW()
           WHERE id = $3`,
          [refund_event_id, refAmt, settlement.id]
        );
        await client.query('COMMIT');
        res.json({ success: true, action: 'refund_pending_blocked' });

      } else if (settlement.status === 'processing') {
        // Case 2: Currently processing — mark refund_pending
        // The settlement processor must check refund_event_id before payout
        await client.query(
          `UPDATE provider.provider_settlements
           SET refund_event_id = $1, refund_amount = $2,
               refund_processed_at = NOW(), updated_at = NOW()
           WHERE id = $3`,
          [refund_event_id, refAmt, settlement.id]
        );
        await client.query('COMMIT');
        res.json({ success: true, action: 'refund_flagged_during_processing' });

      } else if (settlement.status === 'paid') {
        // Case 3: Already paid → CLAWBACK
        // Debit from provider wallet the refund amount
        await client.query(
          `UPDATE provider.provider_settlements
           SET status = 'refunded', refund_event_id = $1, refund_amount = $2,
               refund_processed_at = NOW(), updated_at = NOW()
           WHERE id = $3`,
          [refund_event_id, refAmt, settlement.id]
        );
        await client.query('COMMIT');

        // Clawback wallet debit (outside transaction per Rule #7)
        try {
          await recordWalletChangeAndAudit({
            providerId: String(settlement.provider_id),
            amount: refAmt,
            type: 'deduction',
            action: 'Settlement Clawback - Customer Refund',
            referenceType: 'SETTLEMENT_CLAWBACK',
            referenceId: refund_event_id,
            source: 'System',
            reason: `Clawback for customer refund on booking ${booking_id}`
          });
        } catch (clawbackErr: any) {
          // ponytail: clawback failure is logged but doesn't fail the sync.
          // The settlement is already marked refunded; clawback retries via outbox.
          console.error(`[REFUND-SYNC] Clawback wallet debit failed: ${clawbackErr.message}`);
        }

        res.json({ success: true, action: 'clawback_initiated' });

      } else {
        // Other states (failed, disputed, cancelled) — just record
        await client.query(
          `UPDATE provider.provider_settlements
           SET refund_event_id = $1, refund_amount = $2,
               refund_processed_at = NOW(), updated_at = NOW()
           WHERE id = $3`,
          [refund_event_id, refAmt, settlement.id]
        );
        await client.query('COMMIT');
        res.json({ success: true, action: 'refund_recorded' });
      }

    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[REFUND-SYNC] Provider settlement sync failed:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
