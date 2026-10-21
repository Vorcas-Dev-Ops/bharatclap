import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { BookingRepository, mapBookingRow } from '../../repositories/bookingRepository';
import { PaymentCollectionAuditRepository } from '../../repositories/paymentCollectionAuditRepository';
import { CouponRedemptionRepository } from '../../repositories/couponRedemptionRepository';
import axios from 'axios';
import {
  getUsersBatch,
  getProvidersBatch,
  sendNotification,
  sendProviderNotification,
  enqueueSmsNotification,
  emitSocketEvent,
} from '../../utils/internalApi';

const HIGH_VALUE_THRESHOLD = Number(process.env.HIGH_VALUE_CASH_CONFIRMATION_THRESHOLD) || 2000;

// Shared helper: idempotent settlement + provider release + completion
export const completePaymentAndRelease = async (booking: any, triggeredBy: 'provider' | 'customer' | 'system' | 'admin' = 'system') => {
  const PROV_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
  const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
  const now = new Date();
  const commissionPercentage = booking.commission_percentage ?? 15;
  const db = getDb();

  if (booking.status === 'completed') {
    return;
  }

  const payableAmount = booking.payable_amount || booking.final_amount || 0;

  // Enqueue settlement outbox
  if (booking.provider_id) {
    await db.query(
      `INSERT INTO booking.settlement_outbox (event_id, booking_id, provider_id, amount, status)
       VALUES ($1, $2, $3::uuid, $4, 'PENDING')
       ON CONFLICT (event_id) DO NOTHING`,
      [`settle_${booking.id}`, booking.id, booking.provider_id, payableAmount]
    ).catch(e => console.error('[PAYMENT] Failed to enqueue settlement outbox:', e.message));

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'settlement_enqueued',
      actor: triggeredBy,
      amount: payableAmount,
      timestamp: now,
    });
  }

  // Release provider
  if (booking.provider_id) {
    axios.post(`${PROV_URL}/api/providers/internal/release`, {
      provider_id: booking.provider_id,
    }, {
      headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
    }).catch(e => console.error('[PAYMENT] Failed to release provider:', e.message));

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'provider_released',
      actor: 'system',
      timestamp: now,
    });

    axios.post(`${PROV_URL}/api/providers/internal/referral/trigger-job-reward`, {
      providerId: booking.provider_id.toString(),
      bookingId: booking.id.toString(),
    }, {
      headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
    }).catch(e => console.error('[PAYMENT] Failed to trigger provider referral reward:', e.message));
  }

  // Consume locked coupon
  await CouponRedemptionRepository.deleteByBookingId(booking.id).catch(() => {});

  // Referral evaluation
  axios.post(`${AUTH_URL}/api/referrals/internal/on-booking-completed`, {
    userId: booking.user_id.toString(),
    bookingId: booking.id.toString(),
  }, {
    headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' },
  }).catch(e => console.error('[PAYMENT] Referral evaluation failed:', e.message));

  // Mark completed & paid in bookings and booking_payment_collections
  await db.query(
    `UPDATE booking.bookings
     SET status = 'completed',
         payment_status = 'paid',
         completed_at = $1,
         finance_status = 'settlement_created',
         version = version + 1,
         updated_at = NOW()
     WHERE id = $2`,
    [now, booking.id]
  );

  await db.query(
    `UPDATE booking.booking_payment_collections
     SET status = 'verified',
         collected_amount = final_amount,
         remaining_amount = 0,
         updated_at = NOW()
     WHERE booking_id = $1`,
    [booking.id]
  );

  // Sockets
  emitSocketEvent(booking.user_id.toString(), 'booking_status_update', {
    bookingId: booking.id,
    booking_id: booking.booking_id,
    status: 'completed',
    payment_status: 'paid',
  }).catch(console.error);

  emitSocketEvent(booking.user_id.toString(), 'booking_completed', {
    bookingId: booking.id,
    booking_id: booking.booking_id,
    status: 'completed',
    payment_status: 'paid',
  }).catch(console.error);

  if (booking.provider_id) {
    emitSocketEvent(booking.provider_id.toString(), 'booking_status_update', {
      bookingId: booking.id,
      booking_id: booking.booking_id,
      status: 'completed',
      payment_status: 'paid',
    }).catch(console.error);
  }

  // Outbox event
  const eventId = `booking.completed:${booking.id}`;
  await db.query(
    `INSERT INTO booking.event_outbox (event_id, event_type, payload, status)
     VALUES ($1, 'BookingCompleted', $2, 'PENDING')
     ON CONFLICT (event_id) DO NOTHING`,
    [
      eventId,
      JSON.stringify({
        bookingId: booking.id,
        bookingDisplayId: booking.booking_id,
        userId: booking.user_id,
        providerId: booking.provider_id || null,
        payableAmount,
      })
    ]
  ).catch(err => console.error('[EVENT-OUTBOX] Failed to persist BookingCompleted event:', err.message));

  // Notifications
  const completionMessage = `Your booking ${booking.booking_id} has been marked as completed successfully. Thank you for choosing BharatClap! You can now rate and review your service provider.`;

  if (booking.provider_id) {
    getProvidersBatch([booking.provider_id.toString()]).then(providers => {
      const p = providers[0];
      const uid = p?.user_id?._id?.toString() || p?.user_id?.toString();
      if (uid) sendProviderNotification(uid, 'Booking Completed!', `Booking ${booking.booking_id} is fully completed. Settlement processing.`, 'booking_alert', { booking_id: booking.id }).catch(console.error);
    }).catch(console.error);
  }

  sendNotification(booking.user_id.toString(), 'Rate Your Experience', `Please rate your service for booking ${booking.booking_id}.`, 'system_alert', { booking_id: booking.id }).catch(console.error);

  const users = await getUsersBatch([booking.user_id.toString()]);
  if (users[0]?.phone) {
    enqueueSmsNotification(users[0].phone, 'Booking Completed!', completionMessage).catch(console.error);
  }
};

// Provider: Collect Cash
export const collectCash = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    // Provider authorization: only the assigned provider or admin may collect
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin) {
      if (!booking.provider_id) {
        res.status(403).json({ message: 'No provider assigned to this booking.' });
        return;
      }
      let isAssignedProvider = false;
      try {
        const providers = await getProvidersBatch([booking.provider_id.toString()]);
        const provider = providers[0];
        if (provider && String(provider.user_id?._id || provider.user_id) === String(req.user?._id)) {
          isAssignedProvider = true;
        }
      } catch (_) {}
      if (!isAssignedProvider) {
        res.status(403).json({ message: 'Not authorized: You are not the assigned provider for this booking.' });
        return;
      }
    }

    if (booking.status === 'completed' && booking.payment_status === 'paid') {
      res.json({ message: 'Payment already collected and booking completed', booking });
      return;
    }

    // Phase 6 / Defect D: Online-paid bookings must NEVER enter COD collection
    // ponytail: payment_method comes from b.* but isn't on BookingEntity interface
    const bk = booking as any;
    if (bk.payment_method === 'online' || bk.payment_type === 'online') {
      res.status(409).json({
        code: 'ONLINE_PAYMENT_COD_REJECTED',
        message: 'This booking was paid online. Cash collection is not applicable.'
      });
      return;
    }

    if (booking.payment_status === 'paid') {
      res.status(409).json({
        code: 'ALREADY_PAID',
        message: 'This booking is already marked as paid.'
      });
      return;
    }

    // ponytail: removed 'accepted' — collection only after service work begins
    if (!['in_progress', 'work_completed', 'service_completed', 'waiting_end_otp'].includes(booking.status)) {
      res.status(409).json({
        code: 'INVALID_BOOKING_STATE',
        message: `Cannot collect payment for booking in '${booking.status}' state.`
      });
      return;
    }

    const now = new Date();
    const db = getDb();
    const payableAmount = booking.payable_amount || booking.final_amount || 0;

    // High-value threshold: server-side enforcement
    if (payableAmount >= HIGH_VALUE_THRESHOLD) {
      // For high-value COD, require customer confirmation before completion
      // Insert as 'customer_confirmation_required' instead of immediately completing
      await db.query(
        `INSERT INTO booking.booking_payment_collections (
           booking_id, status, method, final_amount, collected_amount, remaining_amount, confirmed_by, confirmed_at, attempts
         ) VALUES (
           $1, 'customer_confirmation_required', 'cash', $2, $2, 0, 'provider', $3, 1
         ) ON CONFLICT (booking_id) DO UPDATE
           SET status = 'customer_confirmation_required',
               method = 'cash',
               collected_amount = EXCLUDED.final_amount,
               remaining_amount = 0,
               confirmed_by = 'provider',
               confirmed_at = EXCLUDED.confirmed_at,
               attempts = booking.booking_payment_collections.attempts + 1,
               updated_at = NOW()`,
        [booking.id, payableAmount, now]
      );

      await PaymentCollectionAuditRepository.log({
        bookingId: booking.id,
        action: 'high_value_cash_awaiting_customer',
        actor: 'provider',
        amount: payableAmount,
        details: { threshold: HIGH_VALUE_THRESHOLD, device_id: req.body.device_id },
        timestamp: now,
      });

      res.json({
        message: `Cash collection recorded. Amount ₹${payableAmount} exceeds ₹${HIGH_VALUE_THRESHOLD} — customer confirmation required.`,
        requiresCustomerConfirmation: true,
        booking,
      });
      return;
    }

    await db.query(
      `INSERT INTO booking.booking_payment_collections (
         booking_id, status, method, final_amount, collected_amount, remaining_amount, confirmed_by, confirmed_at, attempts
       ) VALUES (
         $1, 'cash_collected', 'cash', $2, $2, 0, 'provider', $3, 1
       ) ON CONFLICT (booking_id) DO UPDATE
         SET status = 'cash_collected',
             method = 'cash',
             collected_amount = EXCLUDED.final_amount,
             remaining_amount = 0,
             confirmed_by = 'provider',
             confirmed_at = EXCLUDED.confirmed_at,
             attempts = booking.booking_payment_collections.attempts + 1,
             updated_at = NOW()`,
      [booking.id, payableAmount, now]
    );

    await db.query(
      `UPDATE booking.bookings SET payment_status = 'paid', version = version + 1, updated_at = NOW() WHERE id = $1`,
      [booking.id]
    );

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'cash_confirmed',
      actor: 'provider',
      amount: payableAmount,
      details: { device_id: req.body.device_id, gps: req.body.gps_coordinates },
      timestamp: now,
    });

    await completePaymentAndRelease(booking, 'provider');
    const fresh = await BookingRepository.findById(booking.id);
    res.json({ message: 'Cash payment collected. Booking completed.', booking: fresh });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Provider: Request UPI Payment Link
export const requestUpi = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005';
    const now = new Date();
    const payableAmount = booking.payable_amount || booking.final_amount || 0;

    const users = await getUsersBatch([booking.user_id.toString()]);
    const customer = users[0];

    let linkData: any;
    try {
      const linkRes = await axios.post(`${PAYMENT_URL}/api/payments/create-collection-link`, {
        booking_id: booking.id,
        booking_display_id: booking.booking_id,
        amount: payableAmount,
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

    const db = getDb();
    // Insert collection link
    const colRes = await db.query(
      `SELECT id FROM booking.booking_payment_collections WHERE booking_id = $1`,
      [booking.id]
    );

    let collectionId = colRes.rows[0]?.id;
    if (!collectionId) {
      const colIns = await db.query(
        `INSERT INTO booking.booking_payment_collections (booking_id, status, method, final_amount, remaining_amount)
         VALUES ($1, 'upi_pending', 'upi', $2, $2) RETURNING id`,
        [booking.id, payableAmount]
      );
      collectionId = colIns.rows[0].id;
    } else {
      await db.query(
        `UPDATE booking.booking_payment_collections
         SET status = 'upi_pending', method = 'upi', attempts = attempts + 1, updated_at = NOW()
         WHERE id = $1`,
        [collectionId]
      );
    }

    // Expire old links
    await db.query(
      `UPDATE booking.payment_collection_links SET status = 'expired' WHERE collection_id = $1 AND status = 'active'`,
      [collectionId]
    );

    // Insert new link
    await db.query(
      `INSERT INTO booking.payment_collection_links (collection_id, link_id, url, amount, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [collectionId, linkData.payment_link_id, linkData.short_url, payableAmount]
    );

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'payment_link_created',
      actor: 'provider',
      amount: payableAmount,
      details: { link_id: linkData.payment_link_id },
      timestamp: now,
    });

    res.json({
      message: 'Payment link generated.',
      payment_link: { url: linkData.short_url, link_id: linkData.payment_link_id, amount: payableAmount },
      booking,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const regeneratePaymentLink = async (req: AuthRequest, res: Response): Promise<void> => {
  return requestUpi(req, res);
};

// Customer: Confirm cash payment
export const confirmCashPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    if (String(booking.user_id) !== String(req.user?._id)) {
      res.status(403).json({ message: 'Only the booking customer can confirm payment.' });
      return;
    }

    const now = new Date();
    const db = getDb();
    await db.query(
      `UPDATE booking.booking_payment_collections
       SET customer_confirmed = true, customer_confirmed_at = $1, updated_at = NOW()
       WHERE booking_id = $2`,
      [now, booking.id]
    );

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'customer_confirmed',
      actor: 'customer',
      amount: booking.payable_amount,
      timestamp: now,
    });

    await completePaymentAndRelease(booking, 'customer');
    const fresh = await BookingRepository.findById(booking.id);
    res.json({ message: 'Payment confirmed. Booking completed.', booking: fresh });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Customer: Dispute payment
export const disputePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const now = new Date();
    const db = getDb();
    await db.query(
      `UPDATE booking.booking_payment_collections
       SET status = 'disputed', updated_at = NOW()
       WHERE booking_id = $1`,
      [booking.id]
    );

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'disputed',
      actor: 'customer',
      details: { reason: req.body.reason },
      timestamp: now,
    });

    const { sendAdminNotification } = await import('../../utils/internalApi');
    sendAdminNotification(
      'Payment Dispute',
      `Customer disputes payment for booking ${booking.booking_id}. Amount: ₹${booking.payable_amount}. Reason: ${req.body.reason || 'Not provided'}`,
      'payment_alert',
      { booking_id: booking.id }
    ).catch(console.error);

    res.json({ message: 'Payment dispute raised. Admin will review.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Payment override
export const adminPaymentOverride = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const now = new Date();
    const action = req.body.action || 'override';
    const db = getDb();
    const collectedAmount = req.body.collected_amount ?? booking.payable_amount;

    await db.query(
      `UPDATE booking.booking_payment_collections
       SET status = 'admin_exception',
           confirmed_by = 'admin',
           confirmed_at = $1,
           collected_amount = $2,
           remaining_amount = final_amount - $2,
           updated_at = NOW()
       WHERE booking_id = $3`,
      [now, collectedAmount, booking.id]
    );

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'admin_override',
      actor: 'admin',
      amount: collectedAmount,
      details: { admin_action: action, notes: req.body.notes },
      timestamp: now,
    });

    if (req.body.complete !== false) {
      await completePaymentAndRelease(booking, 'admin');
    }

    const fresh = await BookingRepository.findById(booking.id);
    res.json({ message: 'Admin override applied.', booking: fresh });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const adminResendLink = async (req: AuthRequest, res: Response): Promise<void> => {
  return requestUpi(req, res);
};

export const adminCancelLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const db = getDb();
    await db.query(
      `UPDATE booking.payment_collection_links
       SET status = 'cancelled'
       WHERE collection_id = (SELECT id FROM booking.booking_payment_collections WHERE booking_id = $1)
         AND status = 'active'`,
      [booking.id]
    );

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'admin_cancel_link',
      actor: 'admin',
      details: { notes: req.body.notes },
      timestamp: new Date(),
    });

    res.json({ message: 'Active payment link(s) cancelled.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const adminMarkOffline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const now = new Date();
    const amount = req.body.amount || booking.payable_amount;
    const db = getDb();

    await db.query(
      `UPDATE booking.booking_payment_collections
       SET status = 'admin_exception',
           method = 'cash',
           collected_amount = $1,
           remaining_amount = final_amount - $1,
           confirmed_by = 'admin',
           confirmed_at = $2,
           updated_at = NOW()
       WHERE booking_id = $3`,
      [amount, now, booking.id]
    );

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'admin_mark_offline',
      actor: 'admin',
      amount,
      details: { method: req.body.method, notes: req.body.notes, reference: req.body.reference },
      timestamp: now,
    });

    await completePaymentAndRelease(booking, 'admin');
    const fresh = await BookingRepository.findById(booking.id);
    res.json({ message: 'Offline payment recorded. Booking completed.', booking: fresh });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const adminForceSettlement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'admin_force_settlement',
      actor: 'admin',
      details: { notes: req.body.notes },
      timestamp: new Date(),
    });

    await completePaymentAndRelease(booking, 'admin');
    const fresh = await BookingRepository.findById(booking.id);
    res.json({ message: 'Settlement forced. Booking completed.', booking: fresh });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const adminRetrySettlement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'admin_retry_settlement',
      actor: 'admin',
      details: { notes: req.body.notes },
      timestamp: new Date(),
    });

    const db = getDb();
    await db.query(
      `INSERT INTO booking.settlement_outbox (event_id, booking_id, provider_id, amount, status, attempts)
       VALUES ($1, $2, $3::uuid, $4, 'PENDING', 0)
       ON CONFLICT (event_id) DO UPDATE
         SET status = 'PENDING', attempts = 0, updated_at = NOW()`,
      [`settle_${booking.id}`, booking.id, booking.provider_id, booking.payable_amount]
    );

    res.json({ message: 'Settlement retry triggered.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const adminRetryPayout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const db = getDb();
    await db.query(
      `UPDATE booking.booking_payment_collections
       SET payout_status = 'pending', updated_at = NOW()
       WHERE booking_id = $1`,
      [booking.id]
    );

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'admin_retry_payout',
      actor: 'admin',
      details: { notes: req.body.notes },
      timestamp: new Date(),
    });

    res.json({ message: 'Payout status reset to pending for retry.', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const internalUpiConfirmed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id, payment_link_id, transaction_id, amount } = req.body;
    const booking = await BookingRepository.findById(booking_id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    if (booking.status === 'completed') {
      res.json({ message: 'Already processed', skipped: true });
      return;
    }

    const now = new Date();
    const db = getDb();
    const paidAmount = amount || booking.payable_amount;

    await db.query(
      `UPDATE booking.booking_payment_collections
       SET status = 'upi_completed',
           transaction_id = $1,
           collected_amount = $2,
           remaining_amount = final_amount - $2,
           confirmed_by = 'system',
           confirmed_at = $3,
           updated_at = NOW()
       WHERE booking_id = $4`,
      [transaction_id, paidAmount, now, booking.id]
    );

    if (payment_link_id) {
      await db.query(
        `UPDATE booking.payment_collection_links SET status = 'paid' WHERE link_id = $1`,
        [payment_link_id]
      );
    }

    await PaymentCollectionAuditRepository.log({
      bookingId: booking.id,
      action: 'upi_success',
      actor: 'system',
      amount: paidAmount,
      details: { payment_link_id, transaction_id },
      timestamp: now,
    });

    await completePaymentAndRelease(booking, 'system');
    res.json({ message: 'UPI payment confirmed. Booking completed.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPaymentCollectionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await BookingRepository.findById(req.params.id);
    if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }

    const db = getDb();
    const resCol = await db.query(
      `SELECT * FROM booking.booking_payment_collections WHERE booking_id = $1`,
      [booking.id]
    );

    res.json({
      booking_id: booking.booking_id,
      status: booking.status,
      payment_method: booking.payment_status,
      payment_collection: resCol.rows[0] || { status: 'none' },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPaymentCollectionAudit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entries = await PaymentCollectionAuditRepository.findByBookingId(req.params.id);
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
