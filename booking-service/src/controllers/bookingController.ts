import { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { Booking } from '../models/Booking';
import { Cart } from '../models/Cart';
import { Order } from '../models/Order';
import { AuthRequest } from '../middleware/authMiddleware';
import { dispatchNearbyProviders, dispatchMultipleBookings } from '../services/bookingDispatchService';
import mongoose from 'mongoose';
import {
  getUsersBatch,
  getAddressesBatch,
  getProvidersBatch,
  getCatalogBatch,
  getActiveMembershipFeatures,
  InternalUser,
  InternalAddress,
  InternalProvider,
  InternalSubService,
  sendAdminNotification
} from '../utils/internalApi';

const populateBookings = async (bookings: any[]) => {
  if (!bookings || bookings.length === 0) return [];

  const userIds = [...new Set(bookings.map(b => b.user_id?.toString()).filter(Boolean))];
  const addressIds = [...new Set(bookings.map(b => b.address_id?.toString()).filter(Boolean))];
  const providerIds = [...new Set(bookings.map(b => b.provider_id?.toString()).filter(Boolean))];
  const subserviceIds = [...new Set(bookings.map(b => b.subservice_id?.toString()).filter(Boolean))];

  const [users, addresses, providers] = await Promise.all([
    getUsersBatch(userIds),
    getAddressesBatch(addressIds),
    getProvidersBatch(providerIds)
  ]);

  const providerUserIds = [...new Set(providers.map((p: any) => p.user_id?.toString()).filter(Boolean))];
  let providerUsers: InternalUser[] = [];
  if (providerUserIds.length > 0) {
    providerUsers = await getUsersBatch(providerUserIds);
  }

  const userMap = new Map(users.map((u: any) => [String(u._id), u]));
  const addressMap = new Map(addresses.map((a: any) => [String(a._id), a]));
  const providerUserMap = new Map(providerUsers.map((u: any) => [String(u._id), u]));
  
  const populatedProviders = providers.map((p: any) => ({
    ...p,
    user_id: providerUserMap.get(String(p.user_id)) || p.user_id
  }));
  const providerMap = new Map(populatedProviders.map((p: any) => [String(p._id), p]));

  let subserviceMap = new Map();
  if (subserviceIds.length > 0) {
    // Call 1: fetch subservices, services, and categories in one round-trip
    const catalogData = await getCatalogBatch(subserviceIds, [], [], [], true);

    const categoryMap = new Map(catalogData.categories.map((c: any) => [String(c._id), c]));
    const serviceMap  = new Map(catalogData.services.map((s: any) => [
      String(s._id),
      { ...s, category_id: categoryMap.get(String(s.category_id)) || s.category_id }
    ]));

    const populatedSubservices = catalogData.subservices.map((s: any) => ({
      ...s,
      service_id: serviceMap.get(String(s.service_id)) || s.service_id
    }));
    subserviceMap = new Map(populatedSubservices.map((s: any) => [String(s._id), s]));
  }

  return bookings.map(b => ({
    ...b,
    user_id: userMap.get(String(b.user_id)) || b.user_id,
    address_id: addressMap.get(String(b.address_id)) || b.address_id,
    provider_id: providerMap.get(String(b.provider_id)) || b.provider_id,
    subservice_id: subserviceMap.get(String(b.subservice_id)) || b.subservice_id
  }));
};

// @desc    Get all bookings (Admin)
// @route   GET /api/bookings
// @access  Private/Admin
export const getAllBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    
    const [bookings, total] = await Promise.all([
      Booking.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments({ isDeleted: false })
    ]);
      
    const populated = await populateBookings(bookings);
    res.json({ data: populated, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get my bookings (Customer or Provider)
// @route   GET /api/bookings/my
// @access  Private
export const getMyBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;

    let query = {};

    if (req.user?.role === 'customer') {
      query = {
        $or: [
          { user_id: new mongoose.Types.ObjectId(req.user._id) },
          { customer_id: new mongoose.Types.ObjectId(req.user._id) }
        ]
      };
    } else if (req.user?.role === 'provider') {
      try {
        const token = req.headers.authorization;
        const response = await axios.get(`${process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003'}/api/providers/me`, {
          headers: { Authorization: token }
        });
        const provider = response.data;
        query = { provider_id: provider ? provider._id : new mongoose.Types.ObjectId() };
      } catch (err) {
        query = { provider_id: new mongoose.Types.ObjectId() };
      }
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(query)
    ]);

    const populated = await populateBookings(bookings);
    res.json({ data: populated, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
// @access  Private
export const getBookingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id).lean();

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // Verify ownership or admin
    if (booking.user_id.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    const populated = await populateBookings([booking]);
    res.json(populated[0]);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get multiple bookings by IDs (Internal API)
// @route   POST /api/bookings/batch
// @access  Public (Internal)
export const getBookingsBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({ message: 'Please provide an array of ids' });
      return;
    }
    const bookings = await Booking.find({ _id: { $in: ids } }).lean();
    res.json(bookings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get aggregated stats for a provider (Internal — replaces full booking list fetch)
// @route   GET /api/bookings/provider/:providerId/stats
// @access  Internal
export const getProviderBookingStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.params.providerId);

    const agg = await Booking.aggregate([
      { $match: { provider_id: providerId, isDeleted: false } },
      {
        $group: {
          _id: '$status',
          count:   { $sum: 1 },
          payout:  { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, { $ifNull: ['$provider_payout', { $multiply: ['$payable_amount', 0.8] }] }, 0] } }
        }
      }
    ]);

    let total_jobs = 0, completed_jobs = 0, earnings = 0;
    for (const row of agg) {
      total_jobs += row.count;
      if (row._id === 'completed') {
        completed_jobs = row.count;
        earnings       = row.payout;
      }
    }

    res.json({ total_jobs, completed_jobs, earnings });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { 
      address,
      payment_method,
      coupon_code
    } = req.body;

    if (!address) {
      res.status(400).json({ message: 'Please select an address' });
      return;
    }

    const cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) });
    if (!cart || cart.items.length === 0) {
      res.status(400).json({ message: 'Cart is empty' });
      return;
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


    const groupBookingId = `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Create the parent Order first
    let finalOrderAmount = 0;
    for (const item of cart.items) {
      const itemPrice = item.price_snapshot * item.quantity;
      const itemDiscount = cart.total_amount > 0 ? (itemPrice / cart.total_amount) * totalDiscount : 0;
      finalOrderAmount += Math.max(0, itemPrice - itemDiscount);
    }

    const order = await Order.create({
      order_id: groupBookingId,
      user_id: new mongoose.Types.ObjectId(req.user?._id),
      booking_ids: [], // will push later
      total_amount: cart.total_amount,
      total_discount: totalDiscount,
      final_amount: finalOrderAmount,
      coupon_code: totalDiscount > 0 ? coupon_code : undefined,
      payment_status: 'pending',
      payment_method: payment_method || 'cod'
    });

    const bookingDocs = cart.items.map(item => {
      const itemPrice = item.price_snapshot * item.quantity;
      const itemDiscount = cart.total_amount > 0 ? (itemPrice / cart.total_amount) * totalDiscount : 0;
      const payableAmount = Math.max(0, itemPrice - itemDiscount);

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
        payable_amount: payableAmount,
        payment_method: payment_method || 'cod',
        status: 'pending',
        refund_status: 'none',
        is_priority: hasPriority,
        is_reviewed: false,
        isDeleted: false
      };
    });

    const createdBookings = await Booking.insertMany(bookingDocs);

    const bookingIds = createdBookings.map(b => b._id as mongoose.Types.ObjectId);
    order.booking_ids.push(...bookingIds);
    
    // Dispatch in background as a single batch
    dispatchMultipleBookings(bookingIds.map(id => id.toString())).catch(err => {
      console.error(`[DISPATCH BATCH ERROR] ${err.message}`);
    });

    await order.save();

    cart.items = [];
    cart.total_amount = 0;
    await cart.save();

    res.status(201).json({
      message: 'Order and Bookings created successfully',
      order_id: order.order_id,
      bookings: createdBookings
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update booking status
// @route   PUT /api/bookings/:id
// @access  Private
export const updateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const { status } = req.body;
    booking.status = status ?? booking.status;

    const updated = await booking.save();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign provider to booking (Internal API)
// @route   PUT /api/bookings/internal/:id/assign
// @access  Public (Internal)
export const assignProviderInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (booking.status !== 'pending') {
      res.status(400).json({ message: 'Booking is already assigned or unavailable' });
      return;
    }

    booking.provider_id = req.body.provider_id;
    booking.status = 'accepted';
    await booking.save();

    res.json(booking);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bookings for a specific user ID
// @route   GET /api/bookings/user/:userId
// @access  Private/Admin
export const getBookingsByUserId = async (req: Request, res: Response): Promise<void> => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = { user_id: new mongoose.Types.ObjectId(req.params.userId) };

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter)
    ]);

    const populated = await populateBookings(bookings);
    res.json({ data: populated, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bookings for a specific provider
// @route   GET /api/bookings/provider/:providerId
// @access  Private/Provider
export const getBookingsByProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = { provider_id: new mongoose.Types.ObjectId(req.params.providerId) };

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter)
    ]);

    const populated = await populateBookings(bookings);
    res.json({ data: populated, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify booking OTP
// @route   POST /api/bookings/:id/verify
// @access  Private
export const verifyBookingOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { otp } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (booking.start_otp !== otp) {
      res.status(400).json({ message: 'Invalid OTP' });
      return;
    }

    let commissionPercentage = 15; // Default system commission

    // Dynamic membership rule: Zero Commission for providers
    if (booking.provider_id) {
      const providers = await getProvidersBatch([booking.provider_id.toString()]);
      const provider = providers.length > 0 ? providers[0] : null;

      if (provider && provider.user_id) {
        const membership = await getActiveMembershipFeatures(provider.user_id.toString());
        if (membership && membership.role === 'provider' && membership.providerConfig?.commissionPercentage !== undefined) {
          commissionPercentage = membership.providerConfig.commissionPercentage;
        }
      }
    }

    const commissionAmount = (booking.payable_amount * commissionPercentage) / 100;
    const providerPayout = booking.payable_amount - commissionAmount;

    booking.status = 'completed';
    (booking as any).commission_percentage = commissionPercentage;
    (booking as any).commission_amount = commissionAmount;
    (booking as any).provider_payout = providerPayout;

    await booking.save();

    res.json({ message: 'Booking verified successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (booking.user_id.toString() !== req.user?._id.toString()) {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    const allowedStatuses = ['pending', 'accepted'];
    if (!allowedStatuses.includes(booking.status)) {
      res.status(400).json({ message: 'Cannot cancel booking in current status' });
      return;
    }

    // Dynamic membership rule: Free Cancellation bypasses the 1-hour window check
    const membership = await getActiveMembershipFeatures(req.user?._id as string);
    const hasFreeCancellation = membership?.role === 'user' && membership?.userConfig?.freeCancellation === true;

    const bookingDateTime = new Date(booking.scheduled_at);
    const diff = bookingDateTime.getTime() - Date.now();
    const oneHour = 60 * 60 * 1000;

    if (diff < oneHour && !hasFreeCancellation) {
      res.status(400).json({ message: 'Cancellation window closed (within 1 hour of service)' });
      return;
    }

    const { reason } = req.body;

    booking.status = 'cancelled';
    booking.cancelled_at = new Date();
    booking.cancelled_by = 'customer';
    booking.cancellation_reason = reason;

    await booking.save();

    sendAdminNotification(
      'Booking Cancelled',
      `Booking ${booking.booking_id} was cancelled by the customer. Reason: ${reason || 'Not provided'}.`,
      'booking_alert',
      { booking_id: booking._id, reason }
    ).catch(console.error);

    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
