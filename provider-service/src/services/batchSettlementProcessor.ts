import mongoose from 'mongoose';
import { ProviderSettlement } from '../models/ProviderSettlement';
import { Provider } from '../models/Provider';
import { SettlementPayoutAttempt } from '../models/SettlementPayoutAttempt';
import { razorpayXService, classifyFailure } from './razorpayXService';

/** Maximum automatic payout attempts before the system stops retrying on its own.
 *  - Automatic retry: permitted only while payout_attempts < MAX_PAYOUT_ATTEMPTS.
 *  - Force Retry: an admin may consciously create attempt N+1 beyond this threshold;
 *    the counter is never reset, so :payout:N keys remain unique across all attempts. */
export const MAX_PAYOUT_ATTEMPTS = 3;

export interface BatchProcessingResult {
  batchId: string;
  totalSubmitted: number;
  claimedCount: number;
  skippedCount: number;
}

/**
 * Process a single settlement payout with atomic state claim and permanent idempotency key.
 */
export async function processSingleSettlementPayout(settlementId: string | mongoose.Types.ObjectId): Promise<boolean> {
  const now = new Date();

  // 1. Atomic claim lock: transition from ready_for_payout -> processing
  const settlement = await ProviderSettlement.findOneAndUpdate(
    {
      _id: settlementId,
      $or: [
        { status: 'ready_for_payout' },
        { status: 'failed', is_non_retryable: { $ne: true }, payout_attempts: { $lt: MAX_PAYOUT_ATTEMPTS } },
      ],
    },
    {
      $set: {
        status: 'processing',
        gateway_payout_status: 'processing',
        is_locked: true,
      },
    },
    { new: true }
  );

  if (!settlement) {
    // Already claimed or not eligible
    return false;
  }

  // 3. Provider Lookup & Bank/Fund Account Verification
  const provider = await Provider.findById(settlement.provider_id);
  if (!provider) {
    settlement.status = 'failed';
    settlement.failure_reason = 'Provider record missing';
    settlement.is_locked = false;
    await settlement.save();
    return false;
  }

  if (!provider.bankDetails || !provider.bankDetails.accountNumber || !provider.bankDetails.ifscCode) {
    settlement.payout_attempts += 1;
    settlement.status = 'failed';
    settlement.is_non_retryable = true;
    settlement.failure_reason = 'Bank details missing or invalid';
    settlement.is_locked = false;
    settlement.audit_trail.push({
      action: 'PAYOUT_FAILED',
      performed_by: 'system',
      timestamp: now,
      notes: settlement.failure_reason,
    });
    await settlement.save();
    return false;
  }

  // Auto-onboard contact/fund account if missing
  let fundAccountId = provider.razorpay_fund_account_id;
  if (!fundAccountId) {
    try {
      let contactId = provider.razorpay_contact_id;
      if (!contactId) {
        const contactRes = await razorpayXService.createContact(provider);
        contactId = contactRes.id;
        provider.razorpay_contact_id = contactId;
      }

      const faRes = await razorpayXService.createFundAccount(contactId, provider.bankDetails);
      fundAccountId = faRes.id;
      provider.razorpay_fund_account_id = fundAccountId;
      provider.bank_last_4 = provider.bankDetails.accountNumber.slice(-4);
      // ponytail: do NOT set VERIFIED here — validation webhook does that
      await provider.save();

      // Skip payout this cycle — wait for fund_account.validation.completed webhook
      console.warn(`[Settlement] Provider ${provider._id} had no fund account — created on-demand, skipping payout this cycle pending validation`);
      settlement.status = 'ready_for_payout';
      settlement.is_locked = false;
      await settlement.save();
      return false;
    } catch (err: any) {
      settlement.payout_attempts += 1;
      settlement.status = 'failed';
      settlement.failure_reason = `RazorpayX Onboarding Error: ${err.message}`;
      settlement.is_locked = false;
      await settlement.save();
      return false;
    }
  }

  // Block payout if bank account not yet validated
  if (provider.bankDetails?.status !== 'verified') {
    console.warn(`[Settlement] Provider ${provider._id} bank not verified (status: ${provider.bankDetails?.status ?? 'missing'}) — skipping payout`);
    settlement.status = 'ready_for_payout';
    settlement.is_locked = false;
    await settlement.save();
    return false;
  }

  // 4. Create Audit Attempt Entry — idempotency key is per-attempt so Force Retry gets a fresh one
  const currentAttemptNum = (settlement.payout_attempts || 0) + 1;
  const idempotencyKey = `bharatclap:settlement:${settlement._id.toString()}:payout:${currentAttemptNum}`;
  settlement.payout_idempotency_key = idempotencyKey;
  const attemptDoc = await SettlementPayoutAttempt.create({
    settlement_id: settlement._id,
    provider_id: provider._id,
    idempotency_key: idempotencyKey,
    amount: settlement.net_payable_amount,
    gateway_payout_status: 'processing',
    attempt_number: currentAttemptNum,
  });

  // 5. Trigger RazorpayX Payout Call
  try {
    const payoutRes = await razorpayXService.createPayout(
      fundAccountId,
      settlement.net_payable_amount,
      idempotencyKey,
      `Settlement ${settlement.booking_display_id || settlement._id}`
    );

    settlement.gateway_payout_id = payoutRes.id;
    settlement.payout_reference_id = payoutRes.id;
    settlement.gateway_payout_status = payoutRes.status as any;
    settlement.gateway_payout_response = payoutRes;

    attemptDoc.razorpay_payout_id = payoutRes.id;
    attemptDoc.gateway_payout_status = payoutRes.status;
    attemptDoc.response_snapshot = payoutRes;

    // Instant settlement check if gateway reports processed immediately
    if (payoutRes.status === 'processed') {
      settlement.status = 'paid';
      settlement.paid_at = now;
      settlement.utr_number = payoutRes.utr || `UTR_${Date.now()}`;
      settlement.audit_trail.push({
        action: 'PAYOUT_COMPLETED',
        performed_by: 'system',
        timestamp: now,
        notes: `Payout processed via RazorpayX (${payoutRes.id}, UTR: ${settlement.utr_number})`,
      });
      attemptDoc.processedAt = now;
    } else {
      // Kept in processing awaiting Razorpay webhook confirmation
      settlement.status = 'processing';
      settlement.audit_trail.push({
        action: 'PAYOUT_SUBMITTED',
        performed_by: 'system',
        timestamp: now,
        notes: `Payout submitted to RazorpayX (${payoutRes.id})`,
      });
    }

    settlement.is_locked = false;
    await settlement.save();
    await attemptDoc.save();

    return true;
  } catch (err: any) {
    const errData = err.response?.data?.error || {};
    const statusCode = err.response?.status;
    const classification = classifyFailure(errData.code, errData.description || err.message, statusCode);

    settlement.payout_attempts = currentAttemptNum;
    settlement.gateway_payout_status = 'failed';
    settlement.failure_reason = classification.failureReason;
    settlement.is_non_retryable = !classification.isRetryable;
    settlement.is_locked = false;

    if (!classification.isRetryable) {
      settlement.status = 'held_by_admin';
      if (provider.bankDetails) {
        provider.bankDetails.status = 'failed';
        await provider.save();
      }
    } else {
      settlement.status = currentAttemptNum >= MAX_PAYOUT_ATTEMPTS ? 'failed' : 'ready_for_payout';
    }

    settlement.audit_trail.push({
      action: 'PAYOUT_FAILED',
      performed_by: 'system',
      timestamp: now,
      notes: classification.failureReason,
    });

    attemptDoc.gateway_payout_status = 'failed';
    attemptDoc.failure_reason = classification.failureReason;
    attemptDoc.is_retryable = classification.isRetryable;
    attemptDoc.response_snapshot = err.response?.data || { message: err.message };

    await settlement.save();
    await attemptDoc.save();

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

  // Process in controlled concurrent chunks of 25
  const CHUNK_SIZE = 25;
  for (let i = 0; i < settlementIds.length; i += CHUNK_SIZE) {
    const chunk = settlementIds.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map(async id => {
        try {
          const success = await processSingleSettlementPayout(id);
          if (success) {
            await ProviderSettlement.updateOne({ _id: id }, { settlement_batch_id: batchId });
          }
          return success;
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

  return {
    batchId,
    totalSubmitted: settlementIds.length,
    claimedCount,
    skippedCount,
  };
}

/**
 * Reconciliation Engine: Queries RazorpayX directly for settlements in 'processing' status
 * whose webhooks were delayed or lost.
 *
 * Also recovers settlements orphaned by a process crash: those claimed by CAS (is_locked: true)
 * but crashed before the RazorpayX call — no gateway_payout_id, stuck forever without this.
 */
export async function reconcileStuckPayouts(): Promise<{ totalStuck: number; reconciledCount: number; orphanReleased: number }> {
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

  // Pass 1: Recover crash-orphaned locks — is_locked with no payout ID, stale for 5+ min.
  // ponytail: bulk update, no loop — all go back to ready_for_payout unconditionally.
  const orphanResult = await ProviderSettlement.updateMany(
    {
      is_locked: true,
      gateway_payout_id: { $in: [null, undefined, ''] },
      updatedAt: { $lte: fiveMinsAgo },
    },
    {
      $set: { is_locked: false, status: 'ready_for_payout' },
      $push: {
        audit_trail: {
          action: 'LOCK_RELEASED_ORPHAN_RECOVERY',
          performed_by: 'system',
          timestamp: new Date(),
          notes: 'CAS lock held >5min with no gateway_payout_id — process crashed before RazorpayX call. Reset to ready_for_payout.',
        },
      },
    }
  );

  if (orphanResult.modifiedCount > 0) {
    console.warn(`[RECONCILIATION] Released ${orphanResult.modifiedCount} orphaned lock(s) (crashed before RazorpayX call).`);
  }

  // Pass 2: Reconcile settlements whose RazorpayX call was made but webhook was lost/delayed.
  const stuckSettlements = await ProviderSettlement.find({
    status: 'processing',
    gateway_payout_id: { $exists: true, $ne: null },
    updatedAt: { $lte: fiveMinsAgo },
  });

  let reconciledCount = 0;

  for (const s of stuckSettlements) {
    try {
      if (!s.gateway_payout_id) continue;
      const payoutStatus = await razorpayXService.getPayoutStatus(s.gateway_payout_id);
      const now = new Date();

      if (payoutStatus.status === 'processed') {
        s.status = 'paid';
        s.gateway_payout_status = 'processed';
        s.paid_at = now;
        s.utr_number = payoutStatus.utr || s.utr_number || `UTR_REC_${Date.now()}`;
        s.audit_trail.push({
          action: 'RECONCILED_VIA_CRON',
          performed_by: 'system',
          timestamp: now,
          notes: `Payout status reconciled directly with RazorpayX. UTR: ${s.utr_number}`,
        });
        await s.save();
        reconciledCount++;
      } else if ((payoutStatus.status as string) === 'failed' || payoutStatus.status === 'reversed' || payoutStatus.status === 'rejected') {
        const classification = classifyFailure(payoutStatus.failure_reason, 'RazorpayX reconciliation reports payout failure');
        s.gateway_payout_status = payoutStatus.status as any;
        s.failure_reason = classification.failureReason;
        s.is_non_retryable = !classification.isRetryable;
        s.status = classification.isRetryable ? 'failed' : 'held_by_admin';
        s.audit_trail.push({
          action: 'RECONCILED_FAILED_VIA_CRON',
          performed_by: 'system',
          timestamp: now,
          notes: `Reconciliation confirmed payout failure: ${classification.failureReason}`,
        });
        await s.save();
        reconciledCount++;
      }
    } catch (err: any) {
      console.error(`[RECONCILIATION-ERROR] Settlement ${s._id}:`, err.message);
    }
  }

  return { totalStuck: stuckSettlements.length, reconciledCount, orphanReleased: orphanResult.modifiedCount };
}

