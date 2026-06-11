import { Request, Response } from 'express';
import { Payment } from '../models/Payment';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose, { Schema } from 'mongoose';

interface ResolvedBooking {
  _id: string;
  booking_id: string;
  subservice_id: string;
  payable_amount: number;
  payment_status: string;
  payment_method?: string;
}

interface ResolvedSubService {
  _id: string;
  subservice_name: string;
}

// Lazy-loaded connections to other DBs for data resolution
let bookingConnection: mongoose.Connection | null = null;
let catalogConnection: mongoose.Connection | null = null;

let BookingModel: any = null;
let SubServiceModel: any = null;

const getBookingModel = () => {
  if (!BookingModel) {
    const bookingDbURI = process.env.BOOKING_DB_URI || 'mongodb://localhost:27017/booking_db';
    bookingConnection = mongoose.createConnection(bookingDbURI);
    
    const bookingSchema = new Schema({
      booking_id: { type: String, required: true },
      user_id: { type: Schema.Types.ObjectId, required: true },
      subservice_id: { type: Schema.Types.ObjectId, required: true },
      payable_amount: { type: Number, required: true },
      payment_status: { type: String, required: true },
      payment_method: { type: String },
      isDeleted: { type: Boolean, default: false }
    }, { strict: false });
    
    BookingModel = bookingConnection.model('Booking', bookingSchema, 'bookings');
  }
  return BookingModel;
};

const getSubServiceModel = () => {
  if (!SubServiceModel) {
    const catalogDbURI = process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db';
    catalogConnection = mongoose.createConnection(catalogDbURI);
    
    const subserviceSchema = new Schema({
      subservice_name: { type: String, required: true }
    }, { strict: false });
    
    SubServiceModel = catalogConnection.model('SubService', subserviceSchema, 'subservices');
  }
  return SubServiceModel;
};

// @desc    Process payment (Mock)
// @route   POST /api/payments
// @access  Private
export const processPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id, amount, payment_method } = req.body;

    const payment = await Payment.create({
      booking_id,
      amount,
      payment_method,
      payment_status: 'completed', // Mocking success
      transaction_id: 'TXN_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      payment_date: new Date()
    });

    res.status(201).json(payment);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get payment details
// @route   GET /api/payments/:bookingId
// @access  Private
export const getPaymentByBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await Payment.findOne({ booking_id: req.params.bookingId });
    if (!payment) {
      res.status(404).json({ message: 'Payment not found' });
      return;
    }

    res.json(payment);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all payments (Admin)
// @route   GET /api/payments
// @access  Private/Admin
export const getAllPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 }).lean();
    
    const bookingIds = payments.map(p => p.booking_id);
    const BModel = getBookingModel();
    const bookings = await BModel.find({ _id: { $in: bookingIds } }).lean();
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id), b]));
    
    const result = payments.map(p => {
      const booking = bookingMap.get(String(p.booking_id));
      return {
        ...p,
        booking_id: booking ?? p.booking_id
      };
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get payments for logged-in user
// @route   GET /api/payments/my
// @access  Private
export const getMyPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    // 1. Get all bookings for this user from booking_db
    const BModel = getBookingModel();
    const bookings = await BModel.find({ user_id: userId, isDeleted: false }).lean();
    
    const bookingIds = bookings.map((b: any) => b._id);
    const subserviceIds = bookings.map((b: any) => b.subservice_id);

    // 2. Fetch payments for those bookings
    const payments = await Payment.find({ booking_id: { $in: bookingIds } })
      .sort({ createdAt: -1 })
      .lean();

    // 3. Fetch subservices from catalog_db to get their names
    const SModel = getSubServiceModel();
    const subservices = await SModel.find({ _id: { $in: subserviceIds } }).lean();
    const subserviceMap = new Map<string, ResolvedSubService>(
      subservices.map((s: any) => [String(s._id), s as ResolvedSubService])
    );

    // 4. Merge payment + booking + subservice info
    const bookingMap = new Map<string, ResolvedBooking>(
      bookings.map((b: any) => [String(b._id), b as ResolvedBooking])
    );

    const result = payments.map(p => {
      const booking = bookingMap.get(String(p.booking_id));
      const subservice = booking ? subserviceMap.get(String(booking.subservice_id)) : null;
      return {
        _id:             p._id,
        booking_id:      booking?.booking_id ?? p.booking_id,
        subservice_name: subservice?.subservice_name ?? '—',
        amount:          p.amount,
        payment_method:  p.payment_method,
        payment_status:  p.payment_status,
        transaction_id:  p.transaction_id ?? '—',
        payment_date:    p.payment_date ?? p.createdAt,
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
