import { Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../config/db';
import { classifyFailure } from '../services/razorpayXService';

export const handleRazorpayPayoutWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const webhookSecret = process.env.RAZORPAY_PAYOUT_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Payout Webhook] RAZORPAY_PAYOUT_WEBHOOK_SECRET is not configured');
      res.status(500).json({ message: 'Webhook processing misconfigured' });
      return;
    }

    const signature = req.headers['x-razorpay-signature'] as string;
    const eventIdHeader = (req.headers['x-razorpay-event-id'] as string) || req.body.event_id || req.body.id;

    if (!signature) {
      res.status(400).json({ message: 'Missing webhook signature' });
      return;
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      console.error('[Payout Webhook] Invalid signature');
      res.status(400).json({ message: 'Invalid webhook signature' });
      return;
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
      await db.query(
        `INSERT INTO provider.razorpay_payout_webhooks (event_id, payload, processed)
         VALUES ($1, $2::jsonb, TRUE)`,
        [String(eventIdHeader), JSON.stringify(eventPayload)]
      );
    } catch (dbErr: any) {
      if (dbErr.code === '23505' || dbErr.message?.includes('duplicate key')) {
        res.status(200).json({ status: 'ACK_DUPLICATE', message: 'Webhook event already processed' });
        return;
      }
      throw dbErr;
    }

    // 2. Find corresponding ProviderSettlement
    const setRes = await db.query(
      `SELECT * FROM provider.provider_settlements
       WHERE payout_reference_id = $1 OR id::text = $1
       LIMIT 1`,
      [payoutId]
    );
    const settlement = setRes.rows[0];

    if (!settlement) {
      res.status(200).json({ status: 'ACK_UNMATCHED', message: 'Settlement record not found for payout' });
      return;
    }

    const now = new Date();

    // 3. Process Webhook Event Types
    if (eventType === 'payout.processed') {
      if (settlement.status === 'paid') {
        res.status(200).json({ status: 'ACK_ALREADY_PAID', settlement_status: 'paid' });
        return;
      }

      const utr = payoutEntity.utr || settlement.payout_utr || `UTR_${Date.now()}`;
      await db.query(
        `UPDATE provider.provider_settlements
         SET status = 'paid',
             payout_utr = $2,
             payout_completed_at = $3,
             audit_trail = COALESCE(audit_trail, '[]'::jsonb) || $4::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [
          settlement.id,
          utr,
          now,
          JSON.stringify([{
            action: 'PAYOUT_PROCESSED_WEBHOOK',
            performed_by: 'system',
            timestamp: now.toISOString(),
            notes: `Webhook confirmed payout completion. UTR: ${utr}`
          }])
        ]
      );

      await db.query(
        `UPDATE provider.settlement_payout_attempts
         SET status = 'processed',
             gateway_response = COALESCE(gateway_response, '{}'::jsonb) || $2::jsonb
         WHERE settlement_id = $1`,
        [settlement.id, JSON.stringify(payoutEntity)]
      );
    } else if (eventType === 'payout.failed' || eventType === 'payout.reversed') {
      const errCode = payoutEntity.failure_reason || 'PAYOUT_FAILED';
      const classification = classifyFailure(errCode, payoutEntity.failure_description || 'RazorpayX webhook reports payout failure');

      const nextStatus = !classification.isRetryable ? 'held_by_admin' : 'failed';

      await db.query(
        `UPDATE provider.provider_settlements
         SET status = $2,
             audit_trail = COALESCE(audit_trail, '[]'::jsonb) || $3::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [
          settlement.id,
          nextStatus,
          JSON.stringify([{
            action: 'PAYOUT_FAILED_WEBHOOK',
            performed_by: 'system',
            timestamp: now.toISOString(),
            notes: `Webhook notification: ${classification.failureReason}`
          }])
        ]
      );

      if (!classification.isRetryable) {
        await db.query(
          `UPDATE provider.provider_bank_details
           SET status = 'rejected',
               updated_at = NOW()
           WHERE provider_id = $1`,
          [settlement.provider_id]
        );
      }

      await db.query(
        `UPDATE provider.settlement_payout_attempts
         SET status = 'failed',
             error_message = $2,
             gateway_response = COALESCE(gateway_response, '{}'::jsonb) || $3::jsonb
         WHERE settlement_id = $1`,
        [settlement.id, classification.failureReason, JSON.stringify(payoutEntity)]
      );
    }

    res.status(200).json({ status: 'ACK_SUCCESS', settlement_status: settlement.status });
  } catch (error: any) {
    console.error('[RAZORPAYX WEBHOOK ERROR]', error.message);
    res.status(500).json({ message: error.message });
  }
};
