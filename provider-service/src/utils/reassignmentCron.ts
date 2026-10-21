import { getDb } from '../config/db';
import { WalletRepository } from '../repositories/walletRepository';
import axios from 'axios';

let cronInterval: NodeJS.Timeout | null = null;

export const startReassignmentCron = () => {
  if (cronInterval) return;

  console.log('[REASSIGNMENT CRON] Automated 10-Second Reassignment Engine Initialized.');

  cronInterval = setInterval(async () => {
    try {
      const now = new Date();
      const pool = getDb();

      // Find and expire pending job requests atomically
      const expireResult = await pool.query(
        `UPDATE provider.job_requests
         SET status = 'expired', updated_at = NOW()
         WHERE status = 'pending' AND expires_at <= $1
         RETURNING id, provider_id, booking_id`,
        [now]
      );

      if (expireResult.rowCount === 0) return;

      for (const req of expireResult.rows) {
        // Release wallet hold if any
        try {
          const holdTxRes = await pool.query(
            `SELECT amount FROM provider.wallet_transactions
             WHERE provider_id = $1 AND type = 'hold' AND reference_id = $2
             LIMIT 1`,
            [req.provider_id, String(req.booking_id)]
          );

          if (holdTxRes.rowCount && holdTxRes.rowCount > 0) {
            const holdAmount = Number(holdTxRes.rows[0].amount) || 0;
            const releaseTxRes = await pool.query(
              `SELECT id FROM provider.wallet_transactions
               WHERE provider_id = $1 AND type = 'release' AND reference_id = $2
               LIMIT 1`,
              [req.provider_id, String(req.booking_id)]
            );

            if (releaseTxRes.rowCount === 0 && holdAmount > 0) {
              await WalletRepository.releaseHold(
                String(req.provider_id),
                holdAmount,
                String(req.booking_id),
                `Release hold for booking dispatch timeout #${req.booking_id}`
              ).catch(() => {});
            }
          }
        } catch (holdErr: any) {
          console.warn('[REASSIGNMENT CRON] Hold release warning:', holdErr.message);
        }

        // Trigger automatic re-dispatch for booking via booking-service internal lookup
        try {
          const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
          const bookingRes = await axios.get(`${BOOKING_URL}/api/bookings/internal/${req.booking_id}`, {
            headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
          });

          // Atomic check: Do NOT re-dispatch if another provider has already accepted
          const acceptedCheck = await pool.query(
            `SELECT id FROM provider.job_requests WHERE booking_id = $1 AND status = 'accepted' LIMIT 1`,
            [req.booking_id]
          );
          if (acceptedCheck.rows.length > 0) {
            continue;
          }

          if (bookingRes.data && bookingRes.data.status === 'provider_searching' && !bookingRes.data.provider_id) {
            if (bookingRes.data.provider_search_expires_at &&
                new Date(bookingRes.data.provider_search_expires_at) <= new Date()) {
              continue;
            }
            const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
            await axios.post(`${providerServiceUrl}/api/providers/internal/dispatch`, {
              booking: bookingRes.data,
              address: bookingRes.data.address
            }, {
              headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
            });
          }
        } catch (dispatchErr) {
          // Non-blocking catch
        }
      }
    } catch (err: any) {
      console.error('[REASSIGNMENT CRON ERROR]', err.message);
    }
  }, 10000);
};

export const stopReassignmentCron = () => {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
};
