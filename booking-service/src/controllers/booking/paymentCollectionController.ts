import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Booking } from '../../models/Booking';
import { PaymentCollectionAudit } from '../../models/PaymentCollectionAudit';
import { BookingActivity } from '../../models/BookingActivity';
import axios from 'axios';
import {
  getUsersBatch,
  getProvidersBatch,
  sendNotification,
  sendProviderNotification,
  enqueueSmsNotification,
} from '../../utils/internalApi';

const HIGH_VALUE_THRESHOLD = Number(process.env.HIGH_VALUE_CASH_CONFIRMATION_THRESHOLD) || 2000;

// ─── Shared helper: idempotent settlement + provider release + completion ───

export const completePaymentAndRelease = async (booking: any, triggeredBy: 'provider' | 'customer' | 'system' | 'admin' = 'system') => {
  const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
  const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
  const now = new Date();
  const snapshot = booking.payment_collection?.financial_snapshot;
  const commissionPercentage = booking.commission_percentage ?? 15;

  // Idempotent: already completed? skip.
  if (booking.status === 'completed') {
    console.log(`[PAYMENT] completePaymentAndRelease skipped — booking ${booking._id} already completed`);
    return;
  }

  // Enqueue durable settlement outbox (poller handles delivery + retries)
  if (booking.provider_id) {
    const { SettlementOutbox } = await import('../../models/SettlementOutbox');
    await SettlementOutbox.create({
      booking_id: booking._id,
      provider_id: booking.provider_id,
      booking_display_id: booking.booking_id,
      payment_type: booking.payment_method === 'cod' ? 'cod' : 'online',
      payable_amount: snapshot?.final_amount ?? booking.payable_amount,
      commission_percentage: commissionPercentage,
    }).catch(e => {
      // 11000 = duplicate key — already enqueued, safe to ignore
      if (e.code !== 11000) console.error('[PAYMENT] Failed to enqueue settlement outbox:', e.message);
    });

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'settlement_enqueued', actor: triggeredBy,
      amount: snapshot?.final_amount ?? booking.payable_amount, timestamp: now,
    }).catch(console.error);
  }

  // Set payout status
  if (booking.payment_collection) {
    booking.payment_collection.payout = { status: 'pending' };
  }

  // Release provider
  if (booking.provider_id) {
    await axios.post(`${PROV_URL}/api/providers/internal/release`, {
      provider_id: booking.provider_id,
    }, {
      headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
    }).catch(e => console.error('[PAYMENT] Failed to release provider:', e.message));

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'provider_released', actor: 'system', timestamp: now,
    }).catch(console.error);

    // Trigger provider referral first-job reward
    axios.post(`${PROV_URL}/api/providers/internal/referral/trigger-job-reward`, {
      providerId: booking.provider_id.toString(),
      bookingId: booking._id.toString(),
    }, {
      headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
    }).catch(e => console.error('[PAYMENT] Failed to trigger provider referral reward:', e.message));
  }

  // Consume locked coupon
  try {
    const { CouponRedemption } = await import('../../models/CouponRedemption');
    const redemption = await CouponRedemption.findOne({ bookingId: booking._id, status: 'locked' });
    if (redemption) {
      redemption.status = 'consumed';
      await redemption.save();
      const CATALOG_URL = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002';
      axios.post(`${CATALOG_URL}/api/coupons/internal/consume`, {
        couponId: redemption.couponId, discountApplied: redemption.discountApplied,
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
      }).catch(e => console.error('[PAYMENT] Failed to consume coupon globally:', e.message));
    }
  } catch (err: any) {
    console.error('[PAYMENT] Coupon consumption failed:', err.message);
  }

  // Referral evaluation
  axios.post(`${AUTH_URL}/api/referrals/internal/on-booking-completed`, {
    userId: booking.user_id.toString(), bookingId: booking._id.toString(),
  }, {
    headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
  }).catch(e => console.error('[PAYMENT] Referral evaluation failed:', e.message));

  // Mark completed
  booking.status = 'completed';
  booking.completed_at = now;
  booking.finance_status = 'settlement_created'; // ponytail: settlement was just created above
  await booking.save();

  // Notifications
  const completionMessage = `Your booking ${booking.booking_id} has been marked as completed successfully. Thank you for choosing BharatClap! You can now rate and review your service provider.`;
  sendNotification(booking.user_id.toString(), 'Booking Completed!', completionMessage, 'booking_alert', { booking_id: booking._id }).catch(console.error);

  if (booking.provider_id) {
    getProvidersBatch([booking.provider_id.toString()]).then(providers => {
      const p = providers[0];
      const uid = p?.user_id?._id?.toString() || p?.user_id?.toString();
      if (uid) sendProviderNotification(uid, 'Booking Completed!', `Booking ${booking.booking_id} is fully completed. Settlement processing.`, 'booking_alert', { booking_id: booking._id }).catch(console.error);
    }).catch(console.error);
  }

  sendNotification(booking.user_id.toString(), 'Rate Your Experience', `Please rate your service for booking ${booking.booking_id}.`, 'system_alert', { booking_id: booking._id }).catch(console.error);

  const users = await getUsersBatch([booking.user_id.toString()]);
  if (users[0]?.phone) {
    enqueueSmsNotification(users[0].phone, 'Booking Completed!', completionMessage).catch(console.error);
  }
};

// ─── Provider: Collect Cash ───

export const collectCash = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    if (booking.status !== 'service_completed' || booking.payment_collection?.status !== 'pending') {
      res.status(400).json({ message: `Cannot collect cash in current state: ${booking.status} / ${booking.payment_collection?.status}` });
      return;
    }

    const now = new Date();
    const pc = booking.payment_collection!;
    pc.status = 'cash_collected';
    pc.method = 'cash';
    pc.collected_amount = pc.final_amount;
    pc.remaining_amount = 0;
    pc.confirmed_by = 'provider';
    pc.confirmed_at = now;
    pc.attempts = (pc.attempts || 0) + 1;
    pc.provider_confirmation = {
      gps_coordinates: req.body.gps_coordinates,
      timestamp: now,
      device_id: req.body.device_id,
      ip_address: (req.ip || req.headers['x-forwarded-for'] || '') as string,
    };

    await booking.save();

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'cash_confirmed', actor: 'provider',
      actor_id: req.user?._id, amount: pc.final_amount,
      metadata: { device_id: req.body.device_id, gps: req.body.gps_coordinates },
      timestamp: now,
    }).catch(console.error);

    // High-value: require customer confirmation
    if (pc.final_amount >= HIGH_VALUE_THRESHOLD) {
      sendNotification(
        booking.user_id.toString(),
        'Confirm Cash Payment',
        `Your provider confirms receiving ₹${pc.final_amount} for booking ${booking.booking_id}. Please confirm this payment.`,
        'payment_alert',
        { booking_id: booking._id, action: 'confirm_cash' }
      ).catch(console.error);

      res.json({ message: 'Cash collected. Awaiting customer confirmation for high-value payment.', booking });
      return;
    }

    // Low-value: complete immediately
    await completePaymentAndRelease(booking, 'provider');
    res.json({ message: 'Payment collected. Booking completed.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Provider: Request UPI Payment Link ───

export const requestUpi = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    if (booking.status !== 'service_completed' || !['pending', 'upi_pending'].includes(booking.payment_collection?.status || '')) {
      res.status(400).json({ message: `Cannot request UPI in current state: ${booking.status} / ${booking.payment_collection?.status}` });
      return;
    }

    const pc = booking.payment_collection!;
    const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005';
    const now = new Date();

    // Fetch customer info for payment link
    const users = await getUsersBatch([booking.user_id.toString()]);
    const customer = users[0];

    let linkData: any;
    try {
      const linkRes = await axios.post(`${PAYMENT_URL}/api/payments/create-collection-link`, {
        booking_id: booking._id,
        booking_display_id: booking.booking_id,
        amount: pc.final_amount,
        customer_name: customer?.name || 'Customer',
        customer_phone: customer?.phone,
        customer_email: customer?.email,
        description: `Payment for BharatClap Booking #${booking.booking_id}`,
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
      });
      linkData = linkRes.data;
    } catch (err: any) {
      console.error('[PAYMENT] Failed to create collection link:', err.message);
      res.status(502).json({ message: 'Failed to generate payment link. Please try again.' });
      return;
    }

    // Mark any existing active links as expired
    if (pc.payment_links) {
      pc.payment_links.forEach((l: any) => { if (l.status === 'active') l.status = 'expired'; });
    }

    // Append new link (never overwrite)
    const newLink = {
      link_id: linkData.payment_link_id,
      url: linkData.short_url,
      amount: pc.final_amount,
      status: 'active' as const,
      created_at: now,
    };
    if (!pc.payment_links) pc.payment_links = [];
    (pc.payment_links as any[]).push(newLink);

    pc.status = 'upi_pending';
    pc.method = 'upi';
    pc.payment_link_id = linkData.payment_link_id;
    pc.payment_link_url = linkData.short_url;
    pc.attempts = (pc.attempts || 0) + 1;

    await booking.save();

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'payment_link_created', actor: 'provider',
      actor_id: req.user?._id, amount: pc.final_amount,
      metadata: { link_id: linkData.payment_link_id, attempt: pc.attempts },
      timestamp: now,
    }).catch(console.error);

    res.json({
      message: 'Payment link generated.',
      payment_link: { url: linkData.short_url, link_id: linkData.payment_link_id, amount: pc.final_amount },
      booking,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Provider: Regenerate expired payment link ───

export const regeneratePaymentLink = async (req: AuthRequest, res: Response): Promise<void> => {
  // Delegates to requestUpi — same logic marks old links expired, appends new
  return requestUpi(req, res);
};

// ─── Customer: Confirm cash payment (high-value) ───

export const confirmCashPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    if (booking.status !== 'service_completed' || booking.payment_collection?.status !== 'cash_collected') {
      res.status(400).json({ message: 'Booking not awaiting cash confirmation.' });
      return;
    }

    // Verify the requesting user is the customer
    if (String(booking.user_id) !== String(req.user?._id)) {
      res.status(403).json({ message: 'Only the booking customer can confirm payment.' });
      return;
    }

    const now = new Date();
    booking.payment_collection!.customer_confirmed = true;
    booking.payment_collection!.customer_confirmed_at = now;
    await booking.save();

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'customer_confirmed', actor: 'customer',
      actor_id: req.user?._id, amount: booking.payment_collection!.final_amount, timestamp: now,
    }).catch(console.error);

    await completePaymentAndRelease(booking, 'customer');
    res.json({ message: 'Payment confirmed. Booking completed.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Customer: Dispute payment ───

export const disputePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    if (booking.status !== 'service_completed') {
      res.status(400).json({ message: 'Cannot dispute in current state.' });
      return;
    }

    const now = new Date();
    booking.payment_collection!.status = 'disputed';
    await booking.save();

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'disputed', actor: 'customer',
      actor_id: req.user?._id, metadata: { reason: req.body.reason }, timestamp: now,
    }).catch(console.error);

    // Notify admin
    const { sendAdminNotification } = await import('../../utils/internalApi');
    sendAdminNotification(
      'Payment Dispute',
      `Customer disputes payment for booking ${booking.booking_id}. Amount: ₹${booking.payment_collection!.final_amount}. Reason: ${req.body.reason || 'Not provided'}`,
      'payment_alert',
      { booking_id: booking._id }
    ).catch(console.error);

    res.json({ message: 'Payment dispute raised. Admin will review.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Admin: Payment override ───

export const adminPaymentOverride = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const now = new Date();
    const action = req.body.action || 'override'; // override | force_settle | mark_offline

    booking.payment_collection!.status = 'admin_exception';
    booking.payment_collection!.confirmed_by = 'admin';
    booking.payment_collection!.confirmed_at = now;
    if (req.body.collected_amount !== undefined) {
      booking.payment_collection!.collected_amount = req.body.collected_amount;
      booking.payment_collection!.remaining_amount = booking.payment_collection!.final_amount - req.body.collected_amount;
    }
    await booking.save();

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'admin_override', actor: 'admin',
      actor_id: req.user?._id, amount: req.body.collected_amount,
      metadata: { admin_action: action, notes: req.body.notes }, timestamp: now,
    }).catch(console.error);

    if (req.body.complete !== false) {
      await completePaymentAndRelease(booking, 'admin');
    }

    res.json({ message: 'Admin override applied.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Admin: Resend / regenerate payment link ───

export const adminResendLink = async (req: AuthRequest, res: Response): Promise<void> => {
  return requestUpi(req, res); // identical logic — marks old link expired, appends new
};

// ─── Admin: Cancel active payment link ───

export const adminCancelLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }
    const pc = booking.payment_collection;
    if (!pc) { res.status(400).json({ message: 'No payment collection data' }); return; }

    const now = new Date();
    // Mark all active links cancelled
    if (pc.payment_links) {
      (pc.payment_links as any[]).forEach((l: any) => { if (l.status === 'active') l.status = 'cancelled'; });
    }
    pc.payment_link_id = undefined;
    pc.payment_link_url = undefined;
    await booking.save();

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'admin_cancel_link', actor: 'admin',
      actor_id: req.user?._id, metadata: { notes: req.body.notes }, timestamp: now,
    }).catch(console.error);

    res.json({ message: 'Active payment link(s) cancelled.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Admin: Mark payment received offline (cash/bank transfer outside app) ───

export const adminMarkOffline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const now = new Date();
    const pc = booking.payment_collection!;
    const amount = req.body.amount || pc.final_amount;
    pc.status = 'admin_exception';
    pc.method = req.body.method || 'cash';
    pc.collected_amount = amount;
    pc.remaining_amount = pc.final_amount - amount;
    pc.confirmed_by = 'admin';
    pc.confirmed_at = now;
    await booking.save();

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'admin_mark_offline', actor: 'admin',
      actor_id: req.user?._id, amount,
      metadata: { method: req.body.method, notes: req.body.notes, reference: req.body.reference },
      timestamp: now,
    }).catch(console.error);

    await completePaymentAndRelease(booking, 'admin');
    res.json({ message: 'Offline payment recorded. Booking completed.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Admin: Force settlement creation ───

export const adminForceSettlement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const now = new Date();
    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'admin_force_settlement', actor: 'admin',
      actor_id: req.user?._id, metadata: { notes: req.body.notes }, timestamp: now,
    }).catch(console.error);

    await completePaymentAndRelease(booking, 'admin');
    res.json({ message: 'Settlement forced. Booking completed.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Admin: Retry failed settlement ───

export const adminRetrySettlement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const now = new Date();
    // Reset idempotency: completePaymentAndRelease will re-try settlement creation
    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'admin_retry_settlement', actor: 'admin',
      actor_id: req.user?._id, metadata: { notes: req.body.notes }, timestamp: now,
    }).catch(console.error);

    const snapshot = booking.payment_collection?.financial_snapshot;
    const { SettlementOutbox } = await import('../../models/SettlementOutbox');
    await SettlementOutbox.findOneAndUpdate(
      { booking_id: booking._id },
      {
        $set: {
          provider_id: booking.provider_id,
          booking_display_id: booking.booking_id,
          payment_type: 'cod',
          payable_amount: snapshot?.final_amount ?? booking.payable_amount,
          commission_percentage: (booking as any).commission_percentage ?? 15,
          status: 'PENDING',
          error_message: undefined,
        },
        $setOnInsert: { attempts: 0 },
      },
      { upsert: true }
    );

    res.json({ message: 'Settlement retry triggered.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Admin: Retry failed provider payout ───

export const adminRetryPayout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const now = new Date();
    if (booking.payment_collection?.payout) {
      booking.payment_collection.payout.status = 'pending';
      await booking.save();
    }

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'admin_retry_payout', actor: 'admin',
      actor_id: req.user?._id, metadata: { notes: req.body.notes }, timestamp: now,
    }).catch(console.error);

    res.json({ message: 'Payout status reset to pending for retry.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Internal: UPI payment confirmed via webhook ───

export const internalUpiConfirmed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id, payment_link_id, transaction_id, amount } = req.body;

    const booking = await Booking.findById(booking_id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    // Idempotent: already processed
    if (['upi_completed', 'verified', 'admin_exception'].includes(booking.payment_collection?.status || '') || booking.status === 'completed') {
      res.json({ message: 'Already processed', skipped: true });
      return;
    }

    const now = new Date();
    const pc = booking.payment_collection!;
    pc.status = 'upi_completed';
    pc.transaction_id = transaction_id;
    pc.collected_amount = amount || pc.final_amount;
    pc.remaining_amount = pc.final_amount - pc.collected_amount;
    pc.confirmed_by = 'system';
    pc.confirmed_at = now;

    // Mark the paid link
    if (pc.payment_links && payment_link_id) {
      const link = (pc.payment_links as any[]).find((l: any) => l.link_id === payment_link_id);
      if (link) link.status = 'paid';
    }

    await booking.save();

    PaymentCollectionAudit.create({
      booking_id: booking._id, action: 'upi_success', actor: 'system',
      amount: pc.collected_amount, metadata: { payment_link_id, transaction_id }, timestamp: now,
    }).catch(console.error);

    await completePaymentAndRelease(booking, 'system');
    res.json({ message: 'UPI payment confirmed. Booking completed.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Query: Get payment collection status ───

export const getPaymentCollectionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id).select('booking_id status payment_collection payment_method payable_amount').lean();
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    res.json({
      booking_id: booking.booking_id,
      status: booking.status,
      payment_method: booking.payment_method,
      payment_collection: booking.payment_collection || { status: 'none' },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Query: Get payment collection audit trail ───

export const getPaymentCollectionAudit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entries = await PaymentCollectionAudit.find({ booking_id: req.params.id })
      .sort({ timestamp: 1 }).lean();
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
