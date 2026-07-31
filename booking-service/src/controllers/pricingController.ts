import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { pricingEngine } from '../services/pricingEngine';
import { PricingQuote } from '../models/PricingQuote';
import mongoose from 'mongoose';

// POST /api/v1/pricing/quote
export const generatePricingQuote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items, time_slot, scheduled_date, city, coupon_code } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Items array is required for pricing quote' });
      return;
    }

    const userId = req.user?._id ? String(req.user._id) : '';

    const quoteResult = await pricingEngine.calculateQuote({
      userId,
      items: items.map((i: any) => ({
        subserviceId: String(i.subservice_id || i.subserviceId),
        quantity: Number(i.quantity) || 1,
        price: Number(i.price) || 0,
        categoryId: i.categoryId ? String(i.categoryId) : undefined
      })),
      timeSlot: time_slot,
      scheduledDate: scheduled_date ? new Date(scheduled_date) : new Date(),
      city: city || 'Bangalore',
      couponCode: coupon_code
    });

    const quoteId = `QT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    const newQuote = await PricingQuote.create({
      quote_id: quoteId,
      user_id: new mongoose.Types.ObjectId(userId || '000000000000000000000000'),
      items: quoteResult.items,
      subtotal: quoteResult.subtotal,
      slot_charge: quoteResult.slot_charge,
      membership_discount: quoteResult.membership_discount,
      coupon_discount: quoteResult.coupon_discount,
      tax_amount: quoteResult.tax_amount,
      final_total: quoteResult.final_total,
      pricingSnapshot: quoteResult.pricingSnapshot,
      hmacSignature: quoteResult.hmacSignature,
      status: 'ACTIVE',
      expires_at: expiresAt
    });

    res.status(201).json({
      success: true,
      quote_id: newQuote.quote_id,
      expires_at: newQuote.expires_at,
      subtotal: newQuote.subtotal,
      slot_charge: newQuote.slot_charge,
      membership_discount: newQuote.membership_discount,
      coupon_discount: newQuote.coupon_discount,
      tax_amount: newQuote.tax_amount,
      final_total: newQuote.final_total,
      hmacSignature: newQuote.hmacSignature,
      explainabilityTrace: newQuote.pricingSnapshot?.explainabilityTrace || []
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/v1/pricing/quote/:quoteId
export const getQuoteDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { quoteId } = req.params;
    const quote = await PricingQuote.findOne({ quote_id: quoteId });

    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    const isExpired = new Date() > quote.expires_at;

    res.json({
      quote_id: quote.quote_id,
      status: isExpired ? 'EXPIRED' : quote.status,
      final_total: quote.final_total,
      slot_charge: quote.slot_charge,
      pricingSnapshot: quote.pricingSnapshot,
      expires_at: quote.expires_at
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
