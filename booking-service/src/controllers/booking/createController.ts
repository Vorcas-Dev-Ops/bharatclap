import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getInternalServiceKey, withTransaction } from '@bharatclap/shared';
import crypto from 'crypto';
import { getDb } from '../../config/db';
import { CartRepository } from '../../repositories/cartRepository';
import { BookingRepository, mapBookingRow } from '../../repositories/bookingRepository';
import { CouponRedemptionRepository } from '../../repositories/couponRedemptionRepository';
import { pricingEngine } from '../../services/pricingEngine';
import { getActiveMembershipFeatures, getCatalogBatch, linkPaymentInternal, verifyPaymentInternal } from '../../utils/internalApi';
import { dispatchMultipleBookings } from '../../services/bookingDispatchService';

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      address,
      payment_method,
      coupon_code,
      payment_id: raw_payment_id,
      correlation_id,
      payment_attempt_id,
      schedule_token,
      preferred_date,
      preferred_start_time,
      scheduling_mode = 'sequential'
    } = req.body;

    const idempotencyKey = req.body.idempotencyKey || req.body.idempotency_key;

    // Block new booking creation if account deletion is in progress
    try {
      const { default: axios } = await import('axios');
      const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
      const internalKey = getInternalServiceKey();
      const userDelRes = await axios.get(`${AUTH_URL}/api/internal/users/${req.user?._id}/deletion-status`, {
        headers: { 'x-internal-service-key': internalKey },
      }).catch(() => null);

      if (userDelRes?.data?.is_deletion_in_progress) {
        res.status(403).json({ message: 'Account deletion is currently in progress. New booking creation is disabled.' });
        return;
      }
    } catch {
      // Non-blocking check fallback
    }

    if (!address) {
      res.status(400).json({ message: 'Please select an address' });
      return;
    }

    const db = getDb();

    // 1. Check idempotency: Return existing bookings if previously created
    if (idempotencyKey) {
      const existingRes = await db.query(
        `SELECT b.* FROM booking.bookings b
         WHERE (b.user_id::text = $1 OR b.user_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1))
           AND b.idempotency_key = $2
           AND b.deleted_at IS NULL`,
        [req.user?._id, idempotencyKey]
      );
      if (existingRes.rows.length > 0) {
        const bookings = existingRes.rows.map(mapBookingRow);
        res.status(201).json({
          message: 'Order and Bookings created successfully (idempotent)',
          order_id: bookings[0].booking_id,
          bookings,
        });
        return;
      }
    }

    const cart = await CartRepository.findByUserId(String(req.user?._id));
    if (!cart || !cart.items || cart.items.length === 0) {
      res.status(400).json({ message: 'Cart is empty' });
      return;
    }

    // Pre-check schedule token before transaction
    if (schedule_token) {
      const [expiresAtStr] = String(schedule_token).split('.');
      const expiresAt = parseInt(expiresAtStr, 10);
      if (isNaN(expiresAt) || Date.now() > expiresAt) {
        res.status(409).json({
          error: 'SCHEDULE_STALE',
          message: 'Your schedule preview has expired. Please re-validate your checkout schedule.'
        });
        return;
      }
    }

    // Auto-cancel any existing unassigned_timeout bookings for the same subservices
    const cartSubserviceIds = cart.items.map(item => item.subservice_id?.toString()).filter(Boolean);
    if (cartSubserviceIds.length > 0) {
      await db.query(
        `UPDATE booking.bookings
         SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'customer', cancellation_reason = 'Re-booked due to high demand timeout'
         WHERE (user_id::text = $1 OR user_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1))
           AND (subservice_id::text = ANY($2::text[]) OR legacy_mongo_id = ANY($2::text[]))
           AND status IN ('pending', 'provider_searching', 'unassigned_timeout')
           AND provider_id IS NULL`,
        [req.user?._id, cartSubserviceIds]
      );
    }

    let totalDiscount = 0;
    const subserviceIds = [...new Set(cart.items.map(item => item.subservice_id?.toString()).filter(Boolean))];

    // Dynamically fetch Membership rules and Catalog Batch in parallel
    const [membership, catalogData] = await Promise.all([
      getActiveMembershipFeatures(req.user?._id as string),
      getCatalogBatch(subserviceIds, [], [], coupon_code ? [coupon_code] : [])
    ]);

    const membershipDiscount = membership?.discountPercentage || 0;
    const hasPriority = membership?.role === 'user' && membership?.userConfig?.priorityBooking === true;

    if (membershipDiscount > 0) {
      totalDiscount += (cart.total * membershipDiscount) / 100;
    }

    const subservices = catalogData.subservices;
    const serviceIds = [...new Set(subservices.map((s: any) => s.service_id?.toString()).filter(Boolean))];
    const catalogData2 = await getCatalogBatch([], serviceIds, [], []);
    const services = catalogData2.services;

    const serviceMap = new Map(services.map((s: any) => [String(s._id), s]));
    const subserviceMap = new Map(subservices.map((s: any) => {
      const mappedS = { ...s, service_id: serviceMap.get(String(s.service_id)) || null };
      return [String(s._id), mappedS];
    }));

    if (coupon_code) {
      const coupon = catalogData.coupons.find((c: any) => c.code === coupon_code);
      if (!coupon) {
        res.status(400).json({ message: 'Invalid coupon code' });
        return;
      }
      if (coupon.status !== 'active') {
        res.status(400).json({ message: 'Coupon is not active' });
        return;
      }
      if (new Date() > new Date(coupon.expiryDate)) {
        res.status(400).json({ message: 'Coupon has expired' });
        return;
      }
      if (cart.total < coupon.minOrderAmount) {
        res.status(400).json({ message: `Minimum order amount of ₹${coupon.minOrderAmount} required` });
        return;
      }
      if (coupon.targetAudience?.includes('members') && !membership) {
        res.status(400).json({ message: 'This coupon is valid for members only' });
        return;
      }
      if (coupon.targetAudience?.includes('first_time')) {
        const prevRes = await db.query(
          `SELECT COUNT(*)::int AS cnt FROM booking.bookings
           WHERE (user_id::text = $1 OR user_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1))
             AND status = 'completed'`,
          [req.user?._id]
        );
        if ((prevRes.rows[0]?.cnt || 0) > 0) {
          res.status(400).json({ message: 'This coupon is valid for first-time users only' });
          return;
        }
      }
      if (coupon.usageLimit > 0) {
        const totalUses = await CouponRedemptionRepository.countTotalUses(coupon_code);
        if (totalUses >= coupon.usageLimit) {
          res.status(400).json({ message: 'Coupon usage limit has been reached' });
          return;
        }
      }
      if (coupon.perUserLimit > 0) {
        const userUses = await CouponRedemptionRepository.countUserRedemptions(coupon._id || coupon_code, String(req.user?._id));
        if (userUses >= coupon.perUserLimit) {
          res.status(400).json({ message: `You have reached the maximum usage limit (${coupon.perUserLimit}) for this coupon` });
          return;
        }
      }

      let eligibleAmount = 0;
      const allowedServicesStrings = (coupon.allowedServices || []).map((id: any) => String(id));
      const allowedCategoriesStrings = (coupon.allowedCategories || []).map((id: any) => String(id));

      for (const item of cart.items) {
        let isEligible = true;
        const subservice: any = subserviceMap.get(String(item.subservice_id));
        if (!subservice) continue;

        if (allowedServicesStrings.length > 0) {
          if (!allowedServicesStrings.includes(String(subservice.service_id?._id)) && !allowedServicesStrings.includes(String(subservice._id))) {
            isEligible = false;
          }
        }
        if (allowedCategoriesStrings.length > 0) {
          if (!allowedCategoriesStrings.includes(String(subservice.service_id?.category_id))) {
            isEligible = false;
          }
        }
        if (isEligible) {
          eligibleAmount += (item.price_snapshot || item.price || 0) * (item.quantity || 1);
        }
      }

      if (eligibleAmount === 0 && (allowedServicesStrings.length > 0 || allowedCategoriesStrings.length > 0)) {
        res.status(400).json({ message: 'Coupon is not applicable for the selected services' });
        return;
      }

      if (coupon.discountType === 'flat') {
        totalDiscount += coupon.discountValue;
      } else if (coupon.discountType === 'percentage') {
        let currentDisc = (eligibleAmount * coupon.discountValue) / 100;
        if (coupon.maxDiscountLimit && currentDisc > coupon.maxDiscountLimit) {
          currentDisc = coupon.maxDiscountLimit;
        }
        totalDiscount += currentDisc;
      }
    }

    // Quote verification
    const { quote_id } = req.body;
    let quoteRecord: any = null;
    if (quote_id) {
      const qRes = await db.query(
        `SELECT * FROM booking.pricing_quotes WHERE quote_id = $1 AND expires_at >= NOW() LIMIT 1`,
        [quote_id]
      );
      quoteRecord = qRes.rows[0] || null;
    }

    let calculatedQuote: any = null;
    if (!quoteRecord) {
      const firstItem = cart.items[0];
      calculatedQuote = await pricingEngine.calculateQuote({
        userId: String(req.user?._id),
        items: cart.items.map(i => ({
          subserviceId: String(i.subservice_id),
          quantity: i.quantity || 1,
          price: i.price_snapshot || i.price || 0
        })),
        timeSlot: firstItem?.selected_time_slot,
        scheduledDate: firstItem?.selected_date ? new Date(firstItem.selected_date) : new Date(),
        couponCode: coupon_code
      });
    }

    const appliedSlotCharge = quoteRecord ? parseFloat(quoteRecord.final_amount) : (calculatedQuote?.slot_charge || 0);
    const appliedSnapshot = quoteRecord ? quoteRecord.pricing_breakdown : (calculatedQuote?.pricingSnapshot || {});
    const appliedTrace = appliedSnapshot?.explainabilityTrace || [];

    const groupBookingId = `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    let finalOrderAmount = 0;
    for (const item of cart.items) {
      const itemPrice = (item.price_snapshot || item.price || 0) * (item.quantity || 1);
      const itemDiscount = cart.total > 0 ? (itemPrice / cart.total) * totalDiscount : 0;
      finalOrderAmount += Math.max(0, itemPrice - itemDiscount);
    }
    finalOrderAmount += appliedSlotCharge;

    // Payment verification
    let payment_status: 'paid' | 'pending' = 'pending';
    let resolvedPaymentId: string | undefined = undefined;

    if (payment_method === 'online') {
      if (!raw_payment_id || typeof raw_payment_id !== 'string' || raw_payment_id.trim() === '') {
        res.status(402).json({ message: 'Online payment reference is missing or invalid. Please complete payment first.' });
        return;
      }
      const verificationResult = await verifyPaymentInternal(raw_payment_id.trim());
      if (!verificationResult || !verificationResult.verified) {
        res.status(402).json({
          message: 'Online payment not verified. Please complete payment before booking.',
          payment_status: verificationResult?.payment?.payment_status || 'not_found',
        });
        return;
      }
      const paymentUserId = verificationResult.payment?.user_id?.toString();
      if (paymentUserId && paymentUserId !== req.user?._id?.toString()) {
        res.status(403).json({ message: 'Payment does not belong to this user.' });
        return;
      }
      resolvedPaymentId = verificationResult.payment?._id?.toString() || raw_payment_id;
      payment_status = 'paid';
    }

    const targetDate = preferred_date || cart.preferred_date || new Date().toISOString().split('T')[0];
    const targetStartStr = preferred_start_time || cart.preferred_start_time || '10:00 AM';
    const mode = scheduling_mode || cart.scheduling_mode || 'sequential';

    const parseSlotToDate = (dateStr: string, timeStr: string): Date => {
      const d = new Date(`${dateStr}T00:00:00+05:30`);
      const match = String(timeStr).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2] ? parseInt(match[2], 10) : 0;
        const period = match[3] ? match[3].toLowerCase() : null;
        if (period === 'pm' && h < 12) h += 12;
        if (period === 'am' && h === 12) h = 0;
        d.setHours(h, m, 0, 0);
      }
      return d;
    };

    const formatDateToSlot = (date: Date): string => {
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    };

    let currentPointer = parseSlotToDate(targetDate, targetStartStr);
    const addressId = address._id || address.id || address;

    // Transactional creation
    const { order, createdBookings } = await withTransaction(db, async (client) => {
      // 1. Create Order
      const orderInsertRes = await client.query(
        `INSERT INTO booking.orders (user_id, items, total_amount, currency, status)
         VALUES (
           (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           $2, $3, 'INR', $4
         ) RETURNING *`,
        [
          req.user?._id,
          JSON.stringify(cart.items),
          finalOrderAmount,
          payment_status === 'paid' ? 'completed' : 'pending'
        ]
      );
      const orderRow = orderInsertRes.rows[0];

      // 2. Insert Bookings
      const insertedBookings: any[] = [];
      for (const item of cart.items) {
        const itemPrice = (item.price_snapshot || item.price || 0) * (item.quantity || 1);
        const itemDiscount = cart.total > 0 ? (itemPrice / cart.total) * totalDiscount : 0;
        const payableAmount = Math.max(0, itemPrice - itemDiscount) + (appliedSlotCharge / cart.items.length);

        const subservice: any = subserviceMap.get(String(item.subservice_id));
        const baseDuration = subservice?.duration_minutes || subservice?.duration || 60;
        const effectiveDuration = baseDuration * (item.quantity || 1);
        const transitionMinutes = 15;

        let itemBookingDate: Date;
        let itemSlotLabel: string;

        if (mode === 'custom' && item.selected_date && item.selected_time_slot) {
          itemBookingDate = parseSlotToDate(item.selected_date, item.selected_time_slot.split('-')[0].trim());
          itemSlotLabel = item.selected_time_slot;
        } else {
          itemBookingDate = new Date(currentPointer.getTime());
          const itemEndDate = new Date(itemBookingDate.getTime() + effectiveDuration * 60 * 1000);
          itemSlotLabel = `${formatDateToSlot(itemBookingDate)} - ${formatDateToSlot(itemEndDate)}`;
          currentPointer = new Date(itemEndDate.getTime() + transitionMinutes * 60 * 1000);
        }

        const plannedEnd = new Date(itemBookingDate.getTime() + effectiveDuration * 60 * 1000);
        const startOtpPlain = crypto.randomInt(100000, 999999).toString();
        const endOtpPlain = crypto.randomInt(100000, 999999).toString();
        const bookingDisplayId = `BK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

        const bookingRes = await client.query(
          `INSERT INTO booking.bookings (
             booking_id, order_id, user_id, subservice_id, address_id,
             variant_name, scheduled_at, booking_time, estimated_duration,
             planned_end_time, service_price, discount_amount, slot_charge,
             payable_amount, slot_pricing_snapshot, pricing_explainability,
             payment_method, payment_status, payment_id, payment_link_status,
             idempotency_key, correlation_id, status, refund_status,
             is_reviewed, start_otp, start_otp_attempts, start_otp_verified,
             end_otp, end_otp_attempts, end_otp_verified
           ) VALUES (
             $1, $2,
             (SELECT id FROM auth.users WHERE id::text = $3 OR legacy_mongo_id = $3 LIMIT 1),
             (SELECT id FROM catalog.subservices WHERE id::text = $4 OR legacy_mongo_id = $4 LIMIT 1),
             (SELECT id FROM auth.addresses WHERE id::text = $5 OR legacy_mongo_id = $5 LIMIT 1),
             $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
             $19::uuid, $20, $21, $22, 'pending', 'none', false, $23, 0, false, $24, 0, false
           ) RETURNING *`,
          [
            bookingDisplayId, orderRow.id, req.user?._id, item.subservice_id, addressId,
            item.package_name || null, itemBookingDate, itemSlotLabel, effectiveDuration,
            plannedEnd, itemPrice, itemDiscount, appliedSlotCharge / cart.items.length,
            payableAmount, JSON.stringify(appliedSnapshot), JSON.stringify(appliedTrace),
            payment_method || 'cod', payment_status, resolvedPaymentId ? resolvedPaymentId : null,
            resolvedPaymentId ? 'linked' : 'pending', idempotencyKey || null, correlation_id || null,
            startOtpPlain, endOtpPlain
          ]
        );
        const mapped = mapBookingRow(bookingRes.rows[0]);
        insertedBookings.push(mapped);

        // Persistent BookingCreated event in outbox
        await client.query(
          `INSERT INTO booking.event_outbox (event_id, event_type, payload, status)
           VALUES ($1, 'BookingCreated', $2, 'PENDING')
           ON CONFLICT (event_id) DO NOTHING`,
          [
            `booking.created:${mapped.id}`,
            JSON.stringify({
              bookingId: mapped.id,
              bookingDisplayId: mapped.booking_id,
              userId: mapped.user_id,
            })
          ]
        );
      }

      // 3. Insert coupon redemption if coupon used
      if (coupon_code && totalDiscount > 0) {
        const coupon = catalogData.coupons.find((c: any) => c.code === coupon_code);
        await client.query(
          `INSERT INTO booking.coupon_redemptions (coupon_id, user_id, booking_id, discount_amount, currency)
           VALUES (
             (SELECT id FROM catalog.coupons WHERE id::text = $1 OR code = $2 OR legacy_mongo_id = $1 LIMIT 1),
             (SELECT id FROM auth.users WHERE id::text = $3 OR legacy_mongo_id = $3 LIMIT 1),
             $4::uuid, $5, 'INR'
           )`,
          [
            coupon?._id || coupon_code,
            coupon_code,
            req.user?._id,
            insertedBookings[0].id,
            totalDiscount
          ]
        );
      }

      // 4. Clear cart
      await client.query(
        `UPDATE booking.carts
         SET items = '[]'::jsonb, total = 0, updated_at = NOW()
         WHERE user_id::text = $1 OR legacy_mongo_id = $1
            OR user_id = (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1)`,
        [req.user?._id]
      );

      return { order: orderRow, createdBookings: insertedBookings };
    });

    // 5. Payment linkage
    if (createdBookings.length > 0) {
      linkPaymentInternal({
        payment_id: resolvedPaymentId,
        booking_id: createdBookings[0].id,
        order_id: order.id,
        user_id: req.user?._id,
        amount: finalOrderAmount,
        payment_method: payment_method || 'cod',
        correlation_id: correlation_id || idempotencyKey,
      }).catch((err) => console.error('[LINK PAYMENT ERROR]', err.message));
    }

    // 6. Background dispatch
    dispatchMultipleBookings(createdBookings.map(b => b.id)).catch((err) => {
      console.error(`[DISPATCH BATCH ERROR] ${err.message}`);
    });

    res.status(201).json({
      message: 'Order and Bookings created successfully',
      order_id: groupBookingId,
      bookings: createdBookings,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
