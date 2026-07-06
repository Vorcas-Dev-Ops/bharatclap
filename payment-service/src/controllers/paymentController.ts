import { Request, Response } from 'express';
import { Payment } from '../models/Payment';
import { AuthRequest } from '../middleware/authMiddleware';
import { getBookingsBatch, getCatalogBatch } from '../utils/internalApi';
import axios from 'axios';
import crypto from 'crypto';

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

// @desc    Process payment (Mock)
// @route   POST /api/payments
// @access  Private
export const processPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id, amount, payment_method } = req.body;
    const user_id = req.user?._id;

    const payment = await Payment.create({
      booking_id,
      user_id,
      amount,
      payment_method,
      payment_status: 'completed', // Mocking success
      transaction_id: `TXN_${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const [payments, total] = await Promise.all([
      Payment.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payment.countDocuments()
    ]);
    
    const bookingIds = payments.map(p => p.booking_id);
    const bookings = await getBookingsBatch(bookingIds.map(String));
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id), b]));
    
    const data = payments.map(p => {
      const booking = bookingMap.get(String(p.booking_id));
      return {
        ...p,
        booking_id: booking ?? p.booking_id
      };
    });
    
    res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
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

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const [payments, total] = await Promise.all([
      Payment.find({ user_id: userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payment.countDocuments({ user_id: userId })
    ]);

    if (payments.length === 0) {
      res.json({ data: [], total, page, limit, pages: 0 });
      return;
    }

    const bookingIds = payments.map((p: any) => p.booking_id);
    
    let bookings: any[] = [];
    try {
      const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:5004';
      const bRes = await axios.post(`${BOOKING_URL}/api/bookings/batch`, { ids: bookingIds }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      });
      bookings = bRes.data;
    } catch (err: any) {
      console.error('Failed to fetch bookings for payments:', err.message);
    }
    
    const subserviceIds = [...new Set(bookings.map((b: any) => b.subservice_id?.toString()).filter(Boolean))];

    // 3. Fetch subservices from catalog_db to get their names
    const catalogData = await getCatalogBatch(subserviceIds, [], [], []);
    const subserviceMap = new Map<string, ResolvedSubService>(
      catalogData.subservices.map((s: any) => [String(s._id), s as ResolvedSubService])
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

    res.json({ data: result, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
