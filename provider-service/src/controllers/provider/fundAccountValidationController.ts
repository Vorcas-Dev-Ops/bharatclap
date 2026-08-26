import { Request, Response } from 'express';
import crypto from 'crypto';
import { Provider } from '../../models/Provider';

const WEBHOOK_SECRET =
  process.env.RAZORPAY_PAYOUT_WEBHOOK_SECRET ||
  process.env.RAZORPAY_WEBHOOK_SECRET ||
  'mock_payout_webhook_secret';

// Loose name match: normalise to lowercase alpha only, then check equality or containment.
// ponytail: ceiling is false positives on very short names — tighten to Levenshtein if needed.
function namesMatch(registered: string | undefined, entered: string | undefined): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const a = norm(registered || '');
  const b = norm(entered || '');
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export const handleFundAccountValidationWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;

    // Signature is required in all environments.
    // Only local dev (NODE_ENV=development) may omit it — explicit opt-in, not an implicit gap.
    if (!signature) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[FAV Webhook] No signature header — allowed in development only');
      } else {
        console.error('[FAV Webhook] Missing x-razorpay-signature header');
        res.status(400).json({ message: 'Missing signature' });
        return;
      }
    } else {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
      if (signature !== expected) {
        console.error('[FAV Webhook] Invalid signature');
        res.status(400).json({ message: 'Invalid signature' });
        return;
      }
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
