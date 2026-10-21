import { Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../../config/db';

/**
 * Authoritative Razorpay Webhook Handler for Provider Orders
 * Enforces:
 * 1. Cryptographic HMAC-SHA256 signature verification
 * 2. Event-level deduplication via provider.processed_webhook_events (event_id UNIQUE)
 * 3. Database transaction locking
 * 4. Idempotent state transitions
 */
export const handleRazorpayProviderWebhook = async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!webhookSecret) {
    console.error('[RAZORPAY WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not configured on server');
    res.status(500).json({ message: 'Webhook misconfigured' });
    return;
  }

  const signature = req.headers['x-razorpay-signature'] as string;
  if (!signature) {
    res.status(400).json({ message: 'Missing x-razorpay-signature header' });
    return;
  }

  // 1. Signature Verification
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.warn('[RAZORPAY WEBHOOK] Invalid HMAC signature received');
    res.status(400).json({ message: 'Invalid webhook signature' });
    return;
  }

  const event = req.body?.event;
  const eventId = String(req.headers['x-razorpay-event-id'] || req.body?.id || '').trim();

  if (!eventId) {
    res.status(400).json({ message: 'Missing event ID in webhook request' });
    return;
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 2. Atomic Event-Level Idempotency Check INSIDE Transaction
    const insertEvent = await client.query(
      `INSERT INTO provider.processed_webhook_events (event_id, event_type, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING id`,
      [eventId, event, JSON.stringify(req.body)]
    );

    if (insertEvent.rows.length === 0) {
      await client.query('COMMIT');
      console.log(`[RAZORPAY WEBHOOK IDEMPOTENCY] Event ${eventId} already processed. Returning 200 OK.`);
      res.status(200).json({ status: 'ACK_DUPLICATE', message: 'Webhook event already processed' });
      return;
    }

    // 3. Process Event (payment.captured / order.paid)
    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = req.body?.payload?.payment?.entity;
      const rzpOrderId = payment?.order_id || req.body?.payload?.order?.entity?.id;
      const rzpPaymentId = payment?.id;

      if (!rzpOrderId) {
        await client.query('COMMIT');
        res.status(200).json({ status: 'IGNORED', message: 'No Razorpay order ID in payload' });
        return;
      }

      // Find and Lock Order FOR UPDATE
      const orderRes = await client.query(
        `SELECT * FROM provider.provider_orders
         WHERE razorpay_order_id = $1 OR (items->'razorpay_order_id')::text = $2
         FOR UPDATE`,
        [rzpOrderId, JSON.stringify(rzpOrderId)]
      );

      const order = orderRes.rows[0];
      if (!order) {
        await client.query('COMMIT');
        res.status(200).json({ status: 'IGNORED', message: 'No matching provider order found' });
        return;
      }

      if (order.status !== 'paid') {
        await client.query(
          `UPDATE provider.provider_orders
           SET status = 'paid',
               razorpay_payment_id = COALESCE(razorpay_payment_id, $1),
               updated_at = NOW()
           WHERE id = $2`,
          [rzpPaymentId, order.id]
        );
      }

      if (order.order_type === 'starter_kit') {
        const provRes = await client.query(
          `SELECT id, kit_payment_status, kit_collection_id, kit_collection_status
           FROM provider.providers WHERE id = $1 FOR UPDATE`,
          [order.provider_id]
        );
        const prov = provRes.rows[0];

        if (prov && prov.kit_payment_status !== 'PAID') {
          // Hub snapshot
          const settingsRes = await client.query(
            `SELECT location_name, collection_address, contact_person, contact_number, collection_instructions, operating_hours
             FROM provider.kit_collection_settings ORDER BY created_at ASC LIMIT 1`
          );
          const hubSnapshot = settingsRes.rows[0] || null;
          const collectionId = prov.kit_collection_id || `BC-KIT-${Math.floor(100000 + Math.random() * 900000)}`;

          await client.query(
            `UPDATE provider.providers
             SET kit_payment_status = 'PAID',
                 kit_payment_id = COALESCE(kit_payment_id, $1),
                 kit_payment_date = NOW(),
                 kit_collection_id = COALESCE(kit_collection_id, $2),
                 kit_collection_status = CASE WHEN kit_collection_status = 'COLLECTED' THEN 'COLLECTED' ELSE 'PENDING' END,
                 kit_collection_hub_snapshot = COALESCE(kit_collection_hub_snapshot, $3::jsonb),
                 onboarding_step = GREATEST(COALESCE(onboarding_step, 0), 4),
                 updated_at = NOW()
             WHERE id = $4`,
            [rzpPaymentId, collectionId, hubSnapshot ? JSON.stringify(hubSnapshot) : null, prov.id]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ status: 'SUCCESS', message: 'Webhook processed successfully' });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[RAZORPAY WEBHOOK TRANSACTION ERROR]', e.message);
    res.status(500).json({ message: 'Webhook processing error', error: e.message });
  } finally {
    client.release();
  }
};
