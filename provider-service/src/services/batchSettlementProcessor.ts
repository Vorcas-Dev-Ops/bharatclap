import mongoose from 'mongoose';
import { ProviderSettlement } from '../models/ProviderSettlement';
import { Provider } from '../models/Provider';
import { SettlementPayoutAttempt } from '../models/SettlementPayoutAttempt';
import { razorpayXService, classifyFailure } from './razorpayXService';

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
        { status: 'failed', is_non_retryable: { $ne: true }, payout_attempts: { $lt: 3 } },
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

  // 2. Generate or reuse permanent idempotency key
  const idempotencyKey = settlement.payout_idempotency_key || `bharatclap:settlement:${settlement._id.toString()}:payout`;
  settlement.payout_idempotency_key = idempotencyKey;
  await settlement.save();

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
      provider.razorpay_account_status = 'VERIFIED';
      provider.bank_verified_at = now;
      provider.bank_last_4 = provider.bankDetails.accountNumber.slice(-4);
      await provider.save();
    } catch (err: any) {
      settlement.payout_attempts += 1;
      settlement.status = 'failed';
      settlement.failure_reason = `RazorpayX Onboarding Error: ${err.message}`;
      settlement.is_locked = false;
      await settlement.save();
      return false;
    }
  }

  // 4. Create Audit Attempt Entry
  const currentAttemptNum = (settlement.payout_attempts || 0) + 1;
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
      settlement.status = currentAttemptNum >= 3 ? 'failed' : 'ready_for_payout';
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
 */
export async function reconcileStuckPayouts(): Promise<{ totalStuck: number; reconciledCount: number }> {
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
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

  return { totalStuck: stuckSettlements.length, reconciledCount };
}
