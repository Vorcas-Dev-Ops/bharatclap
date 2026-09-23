import { Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../../config/db';

function namesMatch(registered?: string, entered?: string): boolean {
  if (!registered || !entered) return false;
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const rWords = clean(registered).split(/\s+/);
  const eWords = clean(entered).split(/\s+/);
  return rWords.some(w => eWords.includes(w));
}

export const handleFundAccountValidationWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookSecret = process.env.RAZORPAY_PAYOUT_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[FAV Webhook] RAZORPAY_PAYOUT_WEBHOOK_SECRET is not configured');
      res.status(500).json({ message: 'Webhook processing misconfigured' });
      return;
    }

    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) {
      console.error('[FAV Webhook] Missing x-razorpay-signature header');
      res.status(400).json({ message: 'Missing signature' });
      return;
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      console.error('[FAV Webhook] Invalid signature');
      res.status(400).json({ message: 'Invalid signature' });
      return;
    }

    const { event, payload } = req.body;

    const validationEntity =
      payload?.fund_account?.validation?.entity ??
      payload?.validation?.entity ??
      payload?.validation;
    const validationId = validationEntity?.id;

    if (!validationId) {
      console.error('[FAV Webhook] No validation id in payload', JSON.stringify(req.body));
      res.status(200).json({ ok: true });
      return;
    }

    const pool = getDb();
    const provRes = await pool.query(
      `SELECT p.id, b.account_holder_name
       FROM provider.providers p
       LEFT JOIN provider.provider_bank_details b ON b.provider_id = p.id
       WHERE p.razorpay_fund_account_id = $1
          OR p.id::text = $1
       LIMIT 1`,
      [validationId]
    );

    if (provRes.rowCount === 0) {
      console.warn('[FAV Webhook] No provider found for validation id', validationId);
      res.status(200).json({ ok: true });
      return;
    }

    const provider = provRes.rows[0];
    const accountStatus = validationEntity?.results?.account_status;
    const registeredName = validationEntity?.results?.registered_name;

    let bankStatus: 'verified' | 'failed' = 'failed';
    let razorpayAccountStatus: 'VERIFIED' | 'FAILED' = 'FAILED';

    if (
      event === 'fund_account.validation.completed' &&
      accountStatus === 'active'
    ) {
      const nameOk = namesMatch(registeredName, provider.account_holder_name);
      bankStatus = nameOk ? 'verified' : 'failed';
      razorpayAccountStatus = nameOk ? 'VERIFIED' : 'FAILED';

      if (!nameOk) {
        console.warn(
          `[FAV Webhook] Name mismatch for provider ${provider.id}: registered="${registeredName}" entered="${provider.account_holder_name}"`
        );
      }
    }

    await pool.query(
      `UPDATE provider.providers
       SET razorpay_account_status = $1, updated_at = NOW()
       WHERE id = $2`,
      [razorpayAccountStatus, provider.id]
    );

    await pool.query(
      `UPDATE provider.provider_bank_details
       SET status = $1, verified_at = NOW(), updated_at = NOW()
       WHERE provider_id = $2`,
      [bankStatus, provider.id]
    );

    console.log(
      `[FAV Webhook] Provider ${provider.id} bank status → ${bankStatus} (razorpay_account_status: ${razorpayAccountStatus})`
    );
    res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[FAV Webhook] Unhandled error:', error?.message);
    res.status(200).json({ ok: true });
  }
};
