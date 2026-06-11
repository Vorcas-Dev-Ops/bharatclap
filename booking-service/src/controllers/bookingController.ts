import { Request, Response } from 'express';
import { Booking } from '../models/Booking';
import { Cart } from '../models/Cart';
import { Order } from '../models/Order';
import { AuthRequest } from '../middleware/authMiddleware';
import { dispatchNearbyProviders } from '../services/bookingDispatchService';
import mongoose, { Schema } from 'mongoose';

// Lazy connections for joins
let authConnection: mongoose.Connection | null = null;
let providerConnection: mongoose.Connection | null = null;
let catalogConnection: mongoose.Connection | null = null;
let paymentConnection: mongoose.Connection | null = null;

let UserModel: any = null;
let AddressModel: any = null;
let ProviderModel: any = null;
let SubServiceModel: any = null;
let ServiceModel: any = null;
let CategoryModel: any = null;
let CouponModel: any = null;
let UserMembershipModel: any = null;

const getAuthDb = () => {
  if (!authConnection) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    authConnection = mongoose.createConnection(authDbURI);
  }
  return authConnection;
};

const getProviderDb = () => {
  if (!providerConnection) {
    const providerDbURI = process.env.PROVIDER_DB_URI || 'mongodb://localhost:27017/provider_db';
    providerConnection = mongoose.createConnection(providerDbURI);
  }
  return providerConnection;
};

const getCatalogDb = () => {
  if (!catalogConnection) {
    const catalogDbURI = process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db';
    catalogConnection = mongoose.createConnection(catalogDbURI);
  }
  return catalogConnection;
};

const getPaymentDb = () => {
  if (!paymentConnection) {
    const paymentDbURI = process.env.PAYMENT_DB_URI || 'mongodb://localhost:27017/payment_db';
    paymentConnection = mongoose.createConnection(paymentDbURI);
  }
  return paymentConnection;
};

const getUserModel = () => {
  if (!UserModel) {
    UserModel = getAuthDb().model('User', new Schema({}, { strict: false }), 'users');
  }
  return UserModel;
};

const getAddressModel = () => {
  if (!AddressModel) {
    AddressModel = getAuthDb().model('Address', new Schema({}, { strict: false }), 'addresses');
  }
  return AddressModel;
};

const getProviderModel = () => {
  if (!ProviderModel) {
    ProviderModel = getProviderDb().model('Provider', new Schema({}, { strict: false }), 'providers');
  }
  return ProviderModel;
};

const getSubServiceModel = () => {
  if (!SubServiceModel) {
    SubServiceModel = getCatalogDb().model('SubService', new Schema({}, { strict: false }), 'subservices');
  }
  return SubServiceModel;
};

const getServiceModel = () => {
  if (!ServiceModel) {
    ServiceModel = getCatalogDb().model('Service', new Schema({}, { strict: false }), 'services');
  }
  return ServiceModel;
};

const getCategoryModel = () => {
  if (!CategoryModel) {
    CategoryModel = getCatalogDb().model('Category', new Schema({}, { strict: false }), 'categories');
  }
  return CategoryModel;
};

const getCouponModel = () => {
  if (!CouponModel) {
    CouponModel = getCatalogDb().model('Coupon', new Schema({}, { strict: false }), 'coupons');
  }
  return CouponModel;
};

const getUserMembershipModel = () => {
  if (!UserMembershipModel) {
    UserMembershipModel = getPaymentDb().model('UserMembership', new Schema({}, { strict: false }), 'usermemberships');
  }
  return UserMembershipModel;
};

const getActiveMembershipFeatures = async (userId: string): Promise<any> => {
  const UMModel = getUserMembershipModel();
  const activeMembership = await UMModel.findOne({ 
    user_id: new mongoose.Types.ObjectId(userId), 
    membership_status: 'active' 
  }).lean();

  if (!activeMembership) return null;
  
  const MModel = getCatalogDb().model('Membership', new Schema({}, { strict: false }), 'memberships');
  const membership = await MModel.findById((activeMembership as any).membership_id).lean();
  
  return membership as any;
};

const populateBookings = async (bookings: any[]) => {
  if (!bookings || bookings.length === 0) return [];

  const userIds = bookings.map(b => b.user_id).filter(Boolean);
  const addressIds = bookings.map(b => b.address_id).filter(Boolean);
  const providerIds = bookings.map(b => b.provider_id).filter(Boolean);
  const subserviceIds = bookings.map(b => b.subservice_id).filter(Boolean);

  const UModel = getUserModel();
  const AModel = getAddressModel();
  const [users, addresses] = await Promise.all([
    UModel.find({ _id: { $in: userIds } }).select('name email phone profile_image').lean(),
    AModel.find({ _id: { $in: addressIds } }).lean()
  ]);

  const userMap = new Map(users.map((u: any) => [String(u._id), u]));
  const addressMap = new Map(addresses.map((a: any) => [String(a._id), a]));

  let providerMap = new Map();
  if (providerIds.length > 0) {
    const PModel = getProviderModel();
    const providers = await PModel.find({ _id: { $in: providerIds } }).lean();
    const providerUserIds = providers.map((p: any) => p.user_id).filter(Boolean);
    const providerUsers = await UModel.find({ _id: { $in: providerUserIds } }).select('name email phone profile_image').lean();
    const providerUserMap = new Map(providerUsers.map((pu: any) => [String(pu._id), pu]));

    const populatedProviders = providers.map((p: any) => ({
      ...p,
      user_id: providerUserMap.get(String(p.user_id)) || p.user_id
    }));
    providerMap = new Map(populatedProviders.map((p: any) => [String(p._id), p]));
  }

  let subserviceMap = new Map();
  if (subserviceIds.length > 0) {
    const SubSModel = getSubServiceModel();
    const SModel = getServiceModel();
    const CModel = getCategoryModel();

    const subservices = await SubSModel.find({ _id: { $in: subserviceIds } }).lean();
    const serviceIds = subservices.map((s: any) => s.service_id).filter(Boolean);
    
    const services = await SModel.find({ _id: { $in: serviceIds } }).lean();
    const categoryIds = services.map((s: any) => s.category_id).filter(Boolean);
    
    const categories = await CModel.find({ _id: { $in: categoryIds } }).select('category_name icon').lean();
    const categoryMap = new Map(categories.map((c: any) => [String(c._id), c]));

    const serviceMap = new Map(services.map((s: any) => [
      String(s._id),
      {
        ...s,
        category_id: categoryMap.get(String(s.category_id)) || s.category_id
      }
    ]));

    const populatedSubservices = subservices.map((s: any) => ({
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
    const bookings = await Booking.find({}).sort({ createdAt: -1 }).lean();
    const populated = await populateBookings(bookings);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get my bookings (Customer or Provider)
// @route   GET /api/bookings/my
// @access  Private
export const getMyBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let query = {};
    
    if (req.user?.role === 'customer') {
      query = { 
        $or: [
          { user_id: new mongoose.Types.ObjectId(req.user._id) },
          { customer_id: new mongoose.Types.ObjectId(req.user._id) }
        ]
      };
    } else if (req.user?.role === 'provider') {
      // Need provider's _id to look up, since we decoupling providers let's look up provider profile from user_id
      const PModel = getProviderModel();
      const provider = await PModel.findOne({ user_id: new mongoose.Types.ObjectId(req.user._id) }).lean();
      
      // Only filter by provider_id — 'customer_id' does not exist on the Booking schema
      query = { provider_id: provider ? provider._id : new mongoose.Types.ObjectId() };
    }

    const bookings = await Booking.find(query).sort({ createdAt: -1 }).lean();
    const populated = await populateBookings(bookings);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
export const getBookingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id).lean();

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // Check authorization
    if (req.user?.role === 'customer' && booking.user_id.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    const populated = await populateBookings([booking]);
    res.json(populated[0]);
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

    // Fetch subservice and service info manually because of separate DBs
    const SubSModel = getSubServiceModel();
    const SModel = getServiceModel();
    
    const subserviceIds = cart.items.map(item => item.subservice_id);
    const subservices = await SubSModel.find({ _id: { $in: subserviceIds } }).lean();
    
    const serviceIds = subservices.map((s: any) => s.service_id).filter(Boolean);
    const services = await SModel.find({ _id: { $in: serviceIds } }).lean();
    
    const serviceMap = new Map(services.map((s: any) => [String(s._id), s]));
    const subserviceMap = new Map(subservices.map((s: any) => {
       const mappedS = { ...s, service_id: serviceMap.get(String(s.service_id)) || null };
       return [String(s._id), mappedS];
    }));

    if (coupon_code) {
      const CModel = getCouponModel();
      const coupon = await CModel.findOne({ code: coupon_code }).lean();
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
        const UMModel = getUserMembershipModel();
        const activeMembership = await UMModel.findOne({ 
          user_id: new mongoose.Types.ObjectId(req.user?._id), 
          membership_status: 'active' 
        });
        if (!activeMembership) {
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
        const totalUses = await Booking.distinct('booking_id', { applied_coupon: coupon_code });
        if (totalUses.length >= coupon.usageLimit) {
          res.status(400).json({ message: 'Coupon usage limit has been reached' });
          return;
        }
      }

      if (coupon.perUserLimit > 0) {
        const userUses = await Booking.distinct('booking_id', { applied_coupon: coupon_code, user_id: new mongoose.Types.ObjectId(req.user?._id) });
        if (userUses.length >= coupon.perUserLimit) {
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

    const createdBookings = [];
    const groupBookingId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

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

    for (const item of cart.items) {
      const itemPrice = item.price_snapshot * item.quantity;
      const itemDiscount = cart.total_amount > 0 ? (itemPrice / cart.total_amount) * totalDiscount : 0;
      const payableAmount = Math.max(0, itemPrice - itemDiscount);

      const itemBookingDate = item.selected_date ? new Date(item.selected_date) : new Date();

      const booking = await Booking.create({
        booking_id: `BK-${Math.floor(100000 + Math.random() * 900000)}`,
        order_id: order._id,
        user_id: new mongoose.Types.ObjectId(req.user?._id),
        subservice_id: item.subservice_id,
        address_id: address._id || address,
        scheduled_at: itemBookingDate,
        booking_time: item.selected_time_slot || 'Flexible',
        service_price: itemPrice,
        discount_amount: itemDiscount,
        payable_amount: payableAmount,
        payment_method: payment_method || 'cod',
        status: 'pending',
        refund_status: 'none',
        is_priority: hasPriority, // Dynamically applied feature
        is_reviewed: false,
        isDeleted: false
      });
      createdBookings.push(booking);
      
      order.booking_ids.push(booking._id as mongoose.Types.ObjectId);
      
      // Dispatch in background
      dispatchNearbyProviders(booking._id.toString()).catch(err => {
        console.error(`[DISPATCH ERROR] ${err.message}`);
      });
    }

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

// @desc    Get bookings for a specific user ID
// @route   GET /api/bookings/user/:userId
// @access  Private/Admin
export const getBookingsByUserId = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookings = await Booking.find({ user_id: new mongoose.Types.ObjectId(req.params.userId) }).sort({ createdAt: -1 }).lean();
    const populated = await populateBookings(bookings);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bookings for a specific provider
// @route   GET /api/bookings/provider/:providerId
// @access  Private/Provider
export const getBookingsByProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookings = await Booking.find({ provider_id: new mongoose.Types.ObjectId(req.params.providerId) }).sort({ createdAt: -1 }).lean();
    const populated = await populateBookings(bookings);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const debugDispatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findOne().sort({ createdAt: -1 });
    if (!booking) {
      res.json({ message: "No bookings found" });
      return;
    }
    
    const { dispatchNearbyProviders } = await import('../services/bookingDispatchService');
    
    // Call the actual dispatch service logic and wait for it
    await dispatchNearbyProviders(booking._id.toString());
    
    // Fetch the updated booking to see if provider_id got assigned
    const updatedBooking = await Booking.findById(booking._id);
    
    res.json({
      message: "Dispatch manually triggered",
      bookingId: booking._id,
      assignedProvider: updatedBooking?.provider_id || "None",
      status: updatedBooking?.status
    });
  } catch(e: any) {
    res.json({ error: e.message });
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
      const PModel = getProviderDb().model('Provider', new Schema({}, { strict: false }), 'providers');
      const provider = await PModel.findById(booking.provider_id).lean() as any;

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

    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
