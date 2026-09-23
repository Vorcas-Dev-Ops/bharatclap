import { Request, Response } from 'express';
import crypto from 'crypto';
import { Provider } from '../../models/Provider';

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

    // Razorpay sends fund_account.validation.completed / fund_account.validation.failed
    // Payload shape: payload.fund_account.validation.entity  (the validation object)
    //                payload.fund_account.entity              (the fund account object)
    const validationEntity =
      payload?.fund_account?.validation?.entity ??
      payload?.validation?.entity ??
      payload?.validation;
    const validationId = validationEntity?.id;

    if (!validationId) {
      console.error('[FAV Webhook] No validation id in payload', JSON.stringify(req.body));
      res.status(200).json({ ok: true }); // ack — don't trigger Razorpay retry storm on malformed payload
      return;
    }

    const provider = await Provider.findOne({ fund_account_validation_id: validationId });
    if (!provider) {
      console.warn('[FAV Webhook] No provider found for validation id', validationId);
      res.status(200).json({ ok: true });
      return;
    }

    const accountStatus = validationEntity?.results?.account_status; // 'active' | 'inactive' | 'not_found'
    const registeredName = validationEntity?.results?.registered_name;

    if (
      event === 'fund_account.validation.completed' &&
      accountStatus === 'active'
    ) {
      const nameOk = namesMatch(registeredName, provider.bankDetails?.accountHolderName);
      provider.bankDetails!.status = nameOk ? 'verified' : 'failed';
      provider.razorpay_account_status = nameOk ? 'VERIFIED' : 'FAILED';

      if (!nameOk) {
        console.warn(
          `[FAV Webhook] Name mismatch for provider ${provider._id}: registered="${registeredName}" entered="${provider.bankDetails?.accountHolderName}"`
        );
      }
    } else {
      // fund_account.validation.failed or account_status !== 'active'
      provider.bankDetails!.status = 'failed';
      provider.razorpay_account_status = 'FAILED';
    }

    provider.bank_verified_at = new Date();
    await provider.save();

    console.log(
      `[FAV Webhook] Provider ${provider._id} bank status → ${provider.bankDetails!.status} (razorpay_account_status: ${provider.razorpay_account_status})`
    );
    res.status(200).json({ ok: true });
  } catch (error: any) {
    // Always ack — avoid Razorpay retry storm on our own bug
    console.error('[FAV Webhook] Unhandled error:', error?.message);
    res.status(200).json({ ok: true });
  }
};
