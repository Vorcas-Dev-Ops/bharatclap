import { getDb } from '../config/db';
import { razorpayXService, classifyFailure } from './razorpayXService';

export const MAX_PAYOUT_ATTEMPTS = 3;

export interface BatchProcessingResult {
  batchId: string;
  totalSubmitted: number;
  claimedCount: number;
  skippedCount: number;
  heldCount: number;
  failedCount: number;
}

export interface PayoutOptions {
  skipCapCheck?: boolean;
}

/**
 * Process a single settlement payout with atomic state claim and permanent idempotency key.
 */
export async function processSingleSettlementPayout(
  settlementId: string,
  opts: PayoutOptions = {}
): Promise<boolean> {
  const db = getDb();
  const now = new Date();

  // 1. Atomic claim lock: transition from ready_for_payout -> processing
  const claimRes = await db.query(
    `UPDATE provider.provider_settlements
     SET status = 'processing',
         is_locked = TRUE,
         updated_at = NOW()
     WHERE (id::text = $1 OR legacy_mongo_id = $1)
       AND (
         status = 'ready_for_payout'
         OR (status = 'failed' AND payout_attempts < $2)
       )
     RETURNING *`,
    [settlementId, MAX_PAYOUT_ATTEMPTS]
  );

  const settlement = claimRes.rows[0];
  if (!settlement) {
    return false;
  }

  // 2. Auto-payout cap check
  if (!opts.skipCapCheck) {
    let maxAutoPayoutAmount = 50000;
    try {
      const cfgRes = await db.query('SELECT settings FROM provider.dispatch_settings LIMIT 1');
      const cfg = cfgRes.rows[0]?.settings || {};
      if (cfg.maxAutoPayoutAmount !== undefined) {
        maxAutoPayoutAmount = Number(cfg.maxAutoPayoutAmount);
      }
    } catch (_) {}

    if (Number(settlement.net_payable_amount) > maxAutoPayoutAmount) {
      await db.query(
        `UPDATE provider.provider_settlements
         SET status = 'held_by_admin',
             is_locked = FALSE,
             audit_trail = COALESCE(audit_trail, '[]'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [
          settlement.id,
          JSON.stringify([{
            action: 'AUTO_HELD_EXCEEDS_CAP',
            performed_by: 'system',
            timestamp: now.toISOString(),
            notes: `Auto-held: payout exceeds auto-payout cap of ₹${maxAutoPayoutAmount}. Admin review required.`
          }])
        ]
      );
      return false;
    }
  }

  // 3. Provider Lookup & Bank/Fund Account Verification
  const provRes = await db.query(
    `SELECT p.*, b.account_holder_name, b.account_number_last4, b.account_number_hash, b.ifsc_code, b.status AS bank_status
     FROM provider.providers p
     LEFT JOIN provider.provider_bank_details b ON b.provider_id = p.id
     WHERE p.id = $1`,
    [settlement.provider_id]
  );
  const provider = provRes.rows[0];

  if (!provider) {
    await db.query(
      `UPDATE provider.provider_settlements
       SET status = 'failed',
           is_locked = FALSE,
           updated_at = NOW()
       WHERE id = $1`,
      [settlement.id]
    );
    return false;
  }

  if (!provider.ifsc_code) {
    await db.query(
      `UPDATE provider.provider_settlements
       SET payout_attempts = payout_attempts + 1,
           status = 'failed',
           is_locked = FALSE,
           audit_trail = COALESCE(audit_trail, '[]'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        settlement.id,
        JSON.stringify([{
          action: 'PAYOUT_FAILED',
          performed_by: 'system',
          timestamp: now.toISOString(),
          notes: 'Bank details missing or invalid'
        }])
      ]
    );
    return false;
  }

  let fundAccountId = provider.razorpay_fund_account_id;
  if (!fundAccountId) {
    try {
      let contactId = provider.razorpay_contact_id;
      if (!contactId) {
        const contactRes = await razorpayXService.createContact(provider);
        contactId = contactRes.id;
        await db.query(`UPDATE provider.providers SET razorpay_contact_id = $1 WHERE id = $2`, [contactId, provider.id]);
      }

      const faRes = await razorpayXService.createFundAccount(contactId, {
        accountHolderName: provider.account_holder_name,
        accountNumber: provider.account_number_last4,
        ifscCode: provider.ifsc_code
      });
      fundAccountId = faRes.id;
      await db.query(`UPDATE provider.providers SET razorpay_fund_account_id = $1 WHERE id = $2`, [fundAccountId, provider.id]);

      await db.query(
        `UPDATE provider.provider_settlements
         SET status = 'ready_for_payout',
             is_locked = FALSE,
             updated_at = NOW()
         WHERE id = $1`,
        [settlement.id]
      );
      return false;
    } catch (err: any) {
      await db.query(
        `UPDATE provider.provider_settlements
         SET payout_attempts = payout_attempts + 1,
             status = 'failed',
             is_locked = FALSE,
             updated_at = NOW()
         WHERE id = $1`,
        [settlement.id]
      );
      return false;
    }
  }

  if (provider.bank_status !== 'verified') {
    await db.query(
      `UPDATE provider.provider_settlements
       SET status = 'ready_for_payout',
           is_locked = FALSE,
           updated_at = NOW()
       WHERE id = $1`,
      [settlement.id]
    );
    return false;
  }

  // 4. Create Audit Attempt Entry
  const currentAttemptNum = (Number(settlement.payout_attempts) || 0) + 1;
  const idempotencyKey = `bharatclap:settlement:${settlement.id}:payout:${currentAttemptNum}`;

  await db.query(
    `INSERT INTO provider.settlement_payout_attempts (
       settlement_id, attempt_number, status, gateway_response
     ) VALUES ($1, $2, 'processing', $3::jsonb)`,
    [settlement.id, currentAttemptNum, JSON.stringify({ idempotency_key: idempotencyKey, amount: settlement.net_payable_amount })]
  );

  // 5. Trigger RazorpayX Payout Call
  try {
    const payoutRes = await razorpayXService.createPayout(
      fundAccountId,
      Number(settlement.net_payable_amount),
      idempotencyKey,
      `Settlement ${settlement.booking_display_id || settlement.id}`
    );

    const isProcessed = payoutRes.status === 'processed';
    const finalStatus = isProcessed ? 'paid' : 'processing';
    const utr = payoutRes.utr || (isProcessed ? `UTR_${Date.now()}` : null);

    await db.query(
      `UPDATE provider.provider_settlements
       SET status = $2,
           payout_reference_id = $3,
           payout_utr = $4,
           payout_idempotency_key = $5,
           payout_completed_at = $6,
           is_locked = FALSE,
           audit_trail = COALESCE(audit_trail, '[]'::jsonb) || $7::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        settlement.id,
        finalStatus,
        payoutRes.id,
        utr,
        idempotencyKey,
        isProcessed ? now : null,
        JSON.stringify([{
          action: isProcessed ? 'PAYOUT_COMPLETED' : 'PAYOUT_SUBMITTED',
          performed_by: 'system',
          timestamp: now.toISOString(),
          notes: isProcessed ? `Payout processed via RazorpayX (${payoutRes.id}, UTR: ${utr})` : `Payout submitted to RazorpayX (${payoutRes.id})`
        }])
      ]
    );

    await db.query(
      `UPDATE provider.settlement_payout_attempts
       SET status = $2,
           gateway_response = $3::jsonb
       WHERE settlement_id = $1 AND attempt_number = $4`,
      [settlement.id, payoutRes.status || finalStatus, JSON.stringify(payoutRes), currentAttemptNum]
    );

    return true;
  } catch (err: any) {
    const errData = err.response?.data?.error || {};
    const statusCode = err.response?.status;
    const classification = classifyFailure(errData.code, errData.description || err.message, statusCode);

    const nextStatus = !classification.isRetryable
      ? 'held_by_admin'
      : (currentAttemptNum >= MAX_PAYOUT_ATTEMPTS ? 'failed' : 'ready_for_payout');

    await db.query(
      `UPDATE provider.provider_settlements
       SET payout_attempts = $2,
           status = $3,
           is_locked = FALSE,
           audit_trail = COALESCE(audit_trail, '[]'::jsonb) || $4::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        settlement.id,
        currentAttemptNum,
        nextStatus,
        JSON.stringify([{
          action: 'PAYOUT_FAILED',
          performed_by: 'system',
          timestamp: now.toISOString(),
          notes: classification.failureReason
        }])
      ]
    );

    await db.query(
      `UPDATE provider.settlement_payout_attempts
       SET status = 'failed',
           error_message = $2,
           gateway_response = $3::jsonb
       WHERE settlement_id = $1 AND attempt_number = $4`,
      [settlement.id, classification.failureReason, JSON.stringify(err.response?.data || { message: err.message }), currentAttemptNum]
    );

    return false;
  }
}

/**
 * Asynchronously process a batch of settlements with chunking and concurrency control.
 */
export async function batchProcessSettlements(settlementIds: string[]): Promise<BatchProcessingResult> {
  const batchId = `batch_${Date.now()}`;
  let claimedCount = 0;
  let skippedCount = 0;

  const CHUNK_SIZE = 25;
  for (let i = 0; i < settlementIds.length; i += CHUNK_SIZE) {
    const chunk = settlementIds.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map(async id => {
        try {
          return await processSingleSettlementPayout(id);
        } catch {
          return false;
        }
      })
    );

    for (const res of results) {
      if (res) claimedCount++;
      else skippedCount++;
    }
  }

  const db = getDb();
  const countRes = await db.query(
    `SELECT status, COUNT(*)::int as count
     FROM provider.provider_settlements
     WHERE id::text = ANY($1) AND status IN ('held_by_admin', 'failed')
     GROUP BY status`,
    [settlementIds]
  );

  const statusMap: Record<string, number> = {};
  for (const row of countRes.rows) {
    statusMap[row.status] = Number(row.count);
  }

  return {
    batchId,
    totalSubmitted: settlementIds.length,
    claimedCount,
    skippedCount,
    heldCount: statusMap['held_by_admin'] || 0,
    failedCount: statusMap['failed'] || 0,
  };
}

/**
 * Reconciliation Engine: Queries RazorpayX directly for settlements in 'processing' status.
 */
export async function reconcileStuckPayouts(): Promise<{ totalStuck: number; reconciledCount: number; orphanReleased: number }> {
  const db = getDb();

  // Pass 1: Recover crash-orphaned locks
  const orphanRes = await db.query(
    `UPDATE provider.provider_settlements
     SET is_locked = FALSE,
         status = 'ready_for_payout',
         audit_trail = COALESCE(audit_trail, '[]'::jsonb) || $1::jsonb,
         updated_at = NOW()
     WHERE is_locked = TRUE
       AND (payout_reference_id IS NULL OR payout_reference_id = '')
       AND updated_at <= NOW() - INTERVAL '5 minutes'`,
    [JSON.stringify([{
      action: 'LOCK_RELEASED_ORPHAN_RECOVERY',
      performed_by: 'system',
      timestamp: new Date().toISOString(),
      notes: 'Lock held >5min with no payout ID. Reset to ready_for_payout.'
    }])]
  );
  const orphanReleased = orphanRes.rowCount || 0;

  // Pass 2: Reconcile settlements in processing status
  const stuckRes = await db.query(
    `SELECT id, payout_reference_id, payout_utr
     FROM provider.provider_settlements
     WHERE status = 'processing'
       AND payout_reference_id IS NOT NULL
       AND updated_at <= NOW() - INTERVAL '5 minutes'`
  );

  let reconciledCount = 0;
  for (const s of stuckRes.rows) {
    try {
      const payoutStatus = await razorpayXService.getPayoutStatus(s.payout_reference_id);
      const now = new Date();

      if (payoutStatus.status === 'processed') {
        const utr = payoutStatus.utr || s.payout_utr || `UTR_REC_${Date.now()}`;
        await db.query(
          `UPDATE provider.provider_settlements
           SET status = 'paid',
               payout_utr = $2,
               payout_completed_at = $3,
               audit_trail = COALESCE(audit_trail, '[]'::jsonb) || $4::jsonb,
               updated_at = NOW()
           WHERE id = $1`,
          [
            s.id,
            utr,
            now,
            JSON.stringify([{
              action: 'RECONCILED_VIA_CRON',
              performed_by: 'system',
              timestamp: now.toISOString(),
              notes: `Payout status reconciled directly with RazorpayX. UTR: ${utr}`
            }])
          ]
        );
        reconciledCount++;
      } else if ((payoutStatus.status as string) === 'failed' || payoutStatus.status === 'reversed' || payoutStatus.status === 'rejected') {
        const classification = classifyFailure(payoutStatus.failure_reason, 'RazorpayX reconciliation reports payout failure');
        const nextStatus = classification.isRetryable ? 'failed' : 'held_by_admin';

        await db.query(
          `UPDATE provider.provider_settlements
           SET status = $2,
               audit_trail = COALESCE(audit_trail, '[]'::jsonb) || $3::jsonb,
               updated_at = NOW()
           WHERE id = $1`,
          [
            s.id,
            nextStatus,
            JSON.stringify([{
              action: 'RECONCILED_FAILED_VIA_CRON',
              performed_by: 'system',
              timestamp: now.toISOString(),
              notes: `Reconciliation confirmed payout failure: ${classification.failureReason}`
            }])
          ]
        );
        reconciledCount++;
      }
    } catch (err: any) {
      console.error(`[RECONCILIATION-ERROR] Settlement ${s.id}:`, err.message);
    }
  }

  return { totalStuck: stuckRes.rowCount || 0, reconciledCount, orphanReleased };
}
