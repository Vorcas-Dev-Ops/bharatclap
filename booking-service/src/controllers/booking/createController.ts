import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { Cart } from '../../models/Cart';
import { Order } from '../../models/Order';
import { Booking } from '../../models/Booking';
import { PricingQuote } from '../../models/PricingQuote';
import { pricingEngine } from '../../services/pricingEngine';
import { getActiveMembershipFeatures, getCatalogBatch, linkPaymentInternal } from '../../utils/internalApi';
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
    } = req.body;

    const idempotencyKey = req.body.idempotencyKey || req.body.idempotency_key;

    if (!address) {
      res.status(400).json({ message: 'Please select an address' });
      return;
    }

    // 1. Check idempotency: Return existing order & bookings if previously created
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotency_key: idempotencyKey });
      if (existingOrder) {
        const bookings = await Booking.find({ order_id: existingOrder._id });
        res.status(201).json({
          message: 'Order and Bookings created successfully (idempotent)',
          order_id: existingOrder.order_id,
          bookings,
        });
        return;
      }
    }

    const cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) });
    if (!cart || cart.items.length === 0) {
      res.status(400).json({ message: 'Cart is empty' });
      return;
    }

    // Prevent duplicate bookings: auto-cancel any existing unassigned_timeout bookings for the same subservices
    const cartSubserviceIds = cart.items.map(item => item.subservice_id?.toString()).filter(Boolean);
    if (cartSubserviceIds.length > 0) {
      await Booking.updateMany(
        {
          user_id: new mongoose.Types.ObjectId(req.user?._id),
          subservice_id: { $in: cartSubserviceIds.map(id => new mongoose.Types.ObjectId(id)) },
          status: { $in: ['pending', 'provider_searching', 'unassigned_timeout'] },
          provider_id: { $exists: false }
        },
        {
          $set: { status: 'cancelled', cancelled_at: new Date(), cancelled_by: 'customer', cancellation_reason: 'Re-booked due to high demand timeout' }
        }
      );
    }

    let totalDiscount = 0;

    // Dynamically fetch and apply Membership rules for the user
    const membership = await getActiveMembershipFeatures(req.user?._id as string);
    const membershipDiscount = membership?.discountPercentage || 0;
    const hasPriority = membership?.role === 'user' && membership?.userConfig?.priorityBooking === true;

    if (membershipDiscount > 0) {
      totalDiscount += (cart.total_amount * membershipDiscount) / 100;
    }

    const subserviceIds = [...new Set(cart.items.map(item => item.subservice_id?.toString()).filter(Boolean))];
    const catalogData = await getCatalogBatch(subserviceIds, [], [], coupon_code ? [coupon_code] : []);

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
      const coupon = catalogData.coupons.find(c => c.code === coupon_code);
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

      if (cart.total_amount < coupon.minOrderAmount) {
        res.status(400).json({ message: `Minimum order amount of ₹${coupon.minOrderAmount} required` });
        return;
      }

      if (coupon.targetAudience?.includes('members')) {
        if (!membership) {
          res.status(400).json({ message: 'This coupon is valid for members only' });
          return;
        }
      }

      if (coupon.targetAudience?.includes('first_time')) {
        const previousBookings = await Booking.countDocuments({ user_id: new mongoose.Types.ObjectId(req.user?._id), status: 'completed' });
        if (previousBookings > 0) {
          res.status(400).json({ message: 'This coupon is valid for first-time users only' });
          return;
        }
      }

      if (coupon.usageLimit > 0) {
        const totalUses = await Booking.countDocuments({ applied_coupon: coupon_code });
        if (totalUses >= coupon.usageLimit) {
          res.status(400).json({ message: 'Coupon usage limit has been reached' });
          return;
        }
      }

      if (coupon.perUserLimit > 0) {
        const userUses = await Booking.countDocuments({ applied_coupon: coupon_code, user_id: new mongoose.Types.ObjectId(req.user?._id) });
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
          eligibleAmount += item.price_snapshot * item.quantity;
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

    // Quote Verification & Pricing Engine Fallback
    const { quote_id } = req.body;
    let quoteRecord = null;

    if (quote_id) {
      quoteRecord = await PricingQuote.findOne({ quote_id, status: 'ACTIVE' });
      if (quoteRecord && new Date() <= quoteRecord.expires_at) {
        quoteRecord.status = 'USED';
        await quoteRecord.save();
      } else {
        quoteRecord = null;
      }
    }

    let calculatedQuote: any = null;
    if (!quoteRecord) {
      const firstItem = cart.items[0];
      calculatedQuote = await pricingEngine.calculateQuote({
        userId: String(req.user?._id),
        items: cart.items.map(i => ({
          subserviceId: String(i.subservice_id),
          quantity: i.quantity,
          price: i.price_snapshot
        })),
        timeSlot: firstItem?.selected_time_slot,
        scheduledDate: firstItem?.selected_date ? new Date(firstItem.selected_date) : new Date(),
        couponCode: coupon_code
      });
    }

    const appliedSlotCharge = quoteRecord ? quoteRecord.slot_charge : (calculatedQuote?.slot_charge || 0);
    const appliedSnapshot = quoteRecord ? quoteRecord.pricingSnapshot : (calculatedQuote?.pricingSnapshot || {});
    const appliedTrace = appliedSnapshot?.explainabilityTrace || [];

    const groupBookingId = `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Calculate final amount including slot charge
    let finalOrderAmount = 0;
    for (const item of cart.items) {
      const itemPrice = item.price_snapshot * item.quantity;
      const itemDiscount = cart.total_amount > 0 ? (itemPrice / cart.total_amount) * totalDiscount : 0;
      finalOrderAmount += Math.max(0, itemPrice - itemDiscount);
    }
    finalOrderAmount += appliedSlotCharge;

    // 2. Fetch/link Payment Record from Payment Service (Payment Service is single source of truth)
    const initialPaymentRecord = await linkPaymentInternal({
      payment_id: raw_payment_id,
      user_id: req.user?._id,
      amount: finalOrderAmount,
      payment_method: payment_method || 'cod',
      correlation_id: correlation_id || idempotencyKey,
      payment_attempt_id,
    });

    if (payment_method === 'online' && initialPaymentRecord && initialPaymentRecord.payment_status === 'failed') {
      res.status(400).json({ message: 'Online payment verification failed or was declined. Booking was not created.' });
      return;
    }

    const payment_status = initialPaymentRecord?.payment_status || (payment_method === 'online' ? 'completed' : 'pending');
    const paymentObjectId = (initialPaymentRecord?._id && mongoose.Types.ObjectId.isValid(initialPaymentRecord._id))
      ? new mongoose.Types.ObjectId(initialPaymentRecord._id)
      : ((raw_payment_id && mongoose.Types.ObjectId.isValid(raw_payment_id)) ? new mongoose.Types.ObjectId(raw_payment_id) : undefined);

    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    try {
      const orderDocs = await Order.create(
        [
          {
            order_id: groupBookingId,
            user_id: new mongoose.Types.ObjectId(req.user?._id),
            booking_ids: [],
            total_amount: cart.total_amount + appliedSlotCharge,
            total_discount: totalDiscount,
            final_amount: finalOrderAmount,
            coupon_code: totalDiscount > 0 ? coupon_code : undefined,
            payment_status: payment_status as any,
            payment_method: payment_method || 'cod',
            payment_id: paymentObjectId,
            payment_link_status: initialPaymentRecord ? 'linked' : 'pending',
            idempotency_key: idempotencyKey,
            correlation_id: correlation_id,
          },
        ],
        session ? { session } : {}
      );
      const order = orderDocs[0];

      const bookingDocs = cart.items.map((item) => {
        const itemPrice = item.price_snapshot * item.quantity;
        const itemDiscount = cart.total_amount > 0 ? (itemPrice / cart.total_amount) * totalDiscount : 0;
        const payableAmount = Math.max(0, itemPrice - itemDiscount) + (appliedSlotCharge / cart.items.length);
        const itemBookingDate = item.selected_date ? new Date(item.selected_date) : new Date();

        return {
          _id: new mongoose.Types.ObjectId(),
          booking_id: `BK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          order_id: order._id,
          user_id: new mongoose.Types.ObjectId(req.user?._id),
          subservice_id: item.subservice_id,
          address_id: address._id || address,
          variant_name: (item as any).package_name || undefined,
          scheduled_at: itemBookingDate,
          booking_time: item.selected_time_slot || 'Flexible',
          service_price: itemPrice,
          discount_amount: itemDiscount,
          slot_charge: appliedSlotCharge / cart.items.length,
          quote_id: quoteRecord ? quoteRecord.quote_id : undefined,
          slotPricingSnapshot: appliedSnapshot,
          pricingExplainabilityTrace: appliedTrace,
          payable_amount: payableAmount,
          payment_method: payment_method || 'cod',
          payment_status: payment_status as any,
          payment_id: paymentObjectId,
          payment_link_status: initialPaymentRecord ? 'linked' : 'pending',
          idempotency_key: idempotencyKey,
          correlation_id: correlation_id,
          status: 'pending',
          refund_status: 'none',
          is_priority: hasPriority,
          is_reviewed: false,
          isDeleted: false,
        };
      });

      const createdBookings = await Booking.insertMany(bookingDocs, session ? { session } : {});

      const bookingIds = createdBookings.map((b) => b._id as mongoose.Types.ObjectId);
      order.booking_ids.push(...bookingIds);
      await order.save(session ? { session } : {});

      if (session) {
        await session.commitTransaction();
        session.endSession();
      }

      // 3. Complete bi-directional Payment ↔ Booking linkage in Payment Service
      if (createdBookings.length > 0) {
        linkPaymentInternal({
          payment_id: paymentObjectId ? paymentObjectId.toString() : undefined,
          booking_id: createdBookings[0]._id.toString(),
          order_id: order._id.toString(),
          user_id: req.user?._id,
          amount: finalOrderAmount,
          payment_method: payment_method || 'cod',
          correlation_id: correlation_id || idempotencyKey,
        }).catch((err) => console.error('[LINK PAYMENT BI-DIRECTIONAL ERROR]', err.message));
      }

      if (coupon_code && totalDiscount > 0) {
        const { CouponRedemption } = await import('../../models/CouponRedemption');
        try {
          const coupon = catalogData.coupons.find((c) => c.code === coupon_code);
          await CouponRedemption.create({
            couponId: coupon?._id,
            couponCode: coupon_code,
            userId: new mongoose.Types.ObjectId(req.user?._id),
            bookingId: createdBookings[0]._id,
            discountApplied: totalDiscount,
            status: 'locked',
            idempotencyKey,
          });
        } catch (err: any) {
          if (err.code === 11000) {
            res.status(409).json({ message: 'This checkout request has already applied the coupon.' });
            return;
          }
          throw err;
        }
      }

      // Dispatch in background as a single batch
      dispatchMultipleBookings(bookingIds.map((id) => id.toString())).catch((err) => {
        console.error(`[DISPATCH BATCH ERROR] ${err.message}`);
      });

      cart.items = [];
      cart.total_amount = 0;
      await cart.save();

      res.status(201).json({
        message: 'Order and Bookings created successfully',
        order_id: order.order_id,
        bookings: createdBookings,
      });
    } catch (txnError: any) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      throw txnError;
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

