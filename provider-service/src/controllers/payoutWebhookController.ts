import { Request, Response } from 'express';
import crypto from 'crypto';
import { ProviderSettlement } from '../models/ProviderSettlement';
import { RazorpayPayoutWebhook } from '../models/RazorpayPayoutWebhook';
import { SettlementPayoutAttempt } from '../models/SettlementPayoutAttempt';
import { Provider } from '../models/Provider';
import { classifyFailure } from '../services/razorpayXService';

const WEBHOOK_SECRET = process.env.RAZORPAY_PAYOUT_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_payout_webhook_secret';

export const handleRazorpayPayoutWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const eventIdHeader = (req.headers['x-razorpay-event-id'] as string) || req.body.event_id || req.body.id;

    // Signature Verification in production mode
    if (signature && process.env.NODE_ENV === 'production') {
      const rawBody = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        res.status(400).json({ message: 'Invalid webhook signature' });
        return;
      }
    }

    const eventPayload = req.body;
    const eventType = eventPayload.event || 'payout.processed';
    const payoutEntity = eventPayload.payload?.payout?.entity || eventPayload.payout || {};
    const payoutId = payoutEntity.id;

    if (!payoutId || !eventIdHeader) {
      res.status(400).json({ message: 'Missing payout ID or event ID in webhook payload' });
      return;
    }

    // 1. Webhook Deduplication via unique event_id constraint
    try {
      await RazorpayPayoutWebhook.create({
        event_id: String(eventIdHeader),
        event_type: eventType,
        payout_id: payoutId,
        payload: eventPayload,
      });
    } catch (dbErr: any) {
      if (dbErr.code === 11000) {
        // Duplicate webhook safely acknowledged
        res.status(200).json({ status: 'ACK_DUPLICATE', message: 'Webhook event already processed' });
        return;
      }
      throw dbErr;
    }

    // 2. Find corresponding ProviderSettlement by gateway_payout_id or payout_reference_id
    const settlement = await ProviderSettlement.findOne({
      $or: [{ gateway_payout_id: payoutId }, { payout_reference_id: payoutId }],
    });

    if (!settlement) {
      res.status(200).json({ status: 'ACK_UNMATCHED', message: 'Settlement record not found for payout' });
      return;
    }

    const now = new Date();

    // 3. Process Webhook Event Types
    if (eventType === 'payout.processed') {
      settlement.status = 'paid';
      settlement.gateway_payout_status = 'processed';
      settlement.paid_at = now;
      settlement.utr_number = payoutEntity.utr || settlement.utr_number || `UTR_${Date.now()}`;
      settlement.audit_trail.push({
        action: 'PAYOUT_PROCESSED_WEBHOOK',
        performed_by: 'system',
        timestamp: now,
        notes: `Webhook confirmed payout completion. UTR: ${settlement.utr_number}`,
      });

      await SettlementPayoutAttempt.updateMany(
        { razorpay_payout_id: payoutId },
        { $set: { gateway_payout_status: 'processed', processedAt: now } }
      );
    } else if (eventType === 'payout.failed' || eventType === 'payout.reversed') {
      const errCode = payoutEntity.failure_reason || 'PAYOUT_FAILED';
      const classification = classifyFailure(errCode, payoutEntity.failure_description || 'RazorpayX webhook reports payout failure');

      settlement.gateway_payout_status = eventType === 'payout.reversed' ? 'reversed' : 'failed';
      settlement.failure_reason = classification.failureReason;
      settlement.is_non_retryable = !classification.isRetryable;

      if (!classification.isRetryable) {
        settlement.status = 'held_by_admin';
        const provider = await Provider.findById(settlement.provider_id);
        if (provider && provider.bankDetails) {
          provider.bankDetails.status = 'failed';
          await provider.save();
        }
      } else {
        settlement.status = 'failed';
      }

      settlement.audit_trail.push({
        action: 'PAYOUT_FAILED_WEBHOOK',
        performed_by: 'system',
        timestamp: now,
        notes: `Webhook notification: ${classification.failureReason}`,
      });

      await SettlementPayoutAttempt.updateMany(
        { razorpay_payout_id: payoutId },
        {
          $set: {
            gateway_payout_status: 'failed',
            failure_reason: classification.failureReason,
            is_retryable: classification.isRetryable,
          },
        }
      );
    }

    await settlement.save();
    res.status(200).json({ status: 'ACK_SUCCESS', settlement_status: settlement.status });
  } catch (error: any) {
    console.error('[RAZORPAYX WEBHOOK ERROR]', error.message);
    res.status(500).json({ message: error.message });
  }
};
