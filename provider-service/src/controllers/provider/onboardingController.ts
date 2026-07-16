import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { ProviderService } from '../../models/ProviderService';
import { StarterKit } from '../../models/StarterKit';
import { ProviderOrder } from '../../models/ProviderOrder';
import { getCatalogBatch } from '../../utils/internalApi';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import axios from 'axios';
import mongoose from 'mongoose';

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:5002';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

const getRazorpay = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/providers/onboarding/starter-kit
// Returns the active starter kit
// ─────────────────────────────────────────────────────────────────────────────
export const getOnboardingStarterKit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const kit = await StarterKit.findOne({ status: 'active', isDeleted: false }).lean();
    if (!kit) {
      res.status(404).json({ message: 'No active starter kit found' });
      return;
    }
    res.json(kit);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/providers/onboarding/accessories
// Returns accessories for the provider's registered category
// ─────────────────────────────────────────────────────────────────────────────
export const getOnboardingAccessories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    // Get provider's subservice IDs → catalog batch to find category IDs
    const providerServices = await ProviderService.find({
      provider_id: provider._id,
      isDeleted: false,
    }).lean();

    const subserviceIds = [
      ...new Set(
        providerServices
          .flatMap((s) => s.subservice_ids)
          .map((id) => id.toString())
      ),
    ];

    let categoryIds: string[] = [];

    if (subserviceIds.length > 0) {
      const catalogData = await getCatalogBatch(subserviceIds, [], [], []);
      const subservices = catalogData?.subservices || [];

      // Collect service IDs from subservices
      const serviceIds: string[] = [
        ...new Set<string>(
          (subservices as any[])
            .map((s) => s.service_id?.toString() as string)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (serviceIds.length > 0) {
        const catalogData2 = await getCatalogBatch([], serviceIds, [], []);
        const services = catalogData2?.services || [];
        categoryIds = [
          ...new Set<string>(
            (services as any[])
              .map((s) => s.category_id?.toString() as string)
              .filter((id): id is string => Boolean(id))
          ),
        ];
      }
    }

    // Fetch accessories from catalog-service
    let url = `${CATALOG_SERVICE_URL}/api/accessories?status=active`;
    if (categoryIds.length > 0) {
      // Use first (primary) category
      url += `&category=${categoryIds[0]}`;
    }

    const { data } = await axios.get(url, {
      headers: { 'x-internal-service-key': INTERNAL_KEY },
    });

    const accessories = Array.isArray(data) ? data : [];
    res.json({ accessories, categoryIds });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/providers/onboarding/create-order
// Creates a Razorpay order for kit + accessories
// ─────────────────────────────────────────────────────────────────────────────
export const createOnboardingOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { kitId, kitSize, accessories } = req.body;
    // accessories: [{ accessory_id, name, quantity, unit_price }]

    const kit = await StarterKit.findById(kitId).lean();
    if (!kit) {
      res.status(404).json({ message: 'Starter kit not found' });
      return;
    }

    // Kit pricing
    const kitBase = kit.price;
    const kitGstAmount = Math.round(kitBase * (kit.gst / 100));
    const delivery = kit.delivery || 0;
    const convenience = kit.convenience || 0;
    const kitTotal = kitBase + kitGstAmount + delivery + convenience;

    // Accessories pricing
    let accSubtotal = 0;
    const accItems: IProviderOrderAccessoryItem[] = [];

    if (Array.isArray(accessories) && accessories.length > 0) {
      for (const acc of accessories) {
        const itemTotal = acc.unit_price * acc.quantity;
        accSubtotal += itemTotal;
        accItems.push({
          accessory_id: acc.accessory_id,
          name: acc.name,
          quantity: acc.quantity,
          unit_price: acc.unit_price,
          total_price: itemTotal,
        });
      }
    }

    const accGst = Math.round(accSubtotal * 0.18);
    const grandTotal = kitTotal + accSubtotal + accGst;

    // Create/replace pending ProviderOrder
    await ProviderOrder.deleteOne({ provider_id: provider._id, payment_status: 'pending' });

    // Create Razorpay order
    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: grandTotal * 100, // paise
      currency: 'INR',
      receipt: `onboard_${provider._id}_${Date.now()}`,
    });

    // Save pending order to DB
    const providerOrder = await ProviderOrder.create({
      provider_id: provider._id,
      kit: {
        kit_id: kit._id,
        kit_name: kit.name,
        price: kitBase,
        gst: kit.gst,
        delivery,
        convenience,
        size: kitSize,
      },
      accessories: accItems,
      subtotal: kitBase + accSubtotal,
      gst_amount: kitGstAmount + accGst,
      grand_total: grandTotal,
      payment_status: 'pending',
      razorpay_order_id: rzpOrder.id,
    });

    res.status(201).json({
      success: true,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      dbOrderId: providerOrder._id,
      breakdown: {
        kitBase,
        kitGst: kitGstAmount,
        delivery,
        convenience,
        accSubtotal,
        accGst,
        grandTotal,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

interface IProviderOrderAccessoryItem {
  accessory_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/providers/onboarding/verify-payment
// Verifies Razorpay signature and marks onboarding complete
// ─────────────────────────────────────────────────────────────────────────────
export const verifyOnboardingPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const generated = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated !== razorpay_signature) {
      res.status(400).json({ message: 'Payment signature verification failed' });
      return;
    }

    // Idempotency: skip if already paid (Razorpay retry or double-submit)
    const existingOrder = await ProviderOrder.findById(dbOrderId).lean();
    if (existingOrder?.payment_status === 'paid') {
      res.json({ success: true, message: 'Payment already verified' });
      return;
    }

    // Atomic update: both writes succeed or both roll back
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();

        await ProviderOrder.findByIdAndUpdate(dbOrderId, {
          payment_status: 'paid',
          payment_id: razorpay_payment_id,
          paidAt: now,
          fulfillmentStatus: 'awaiting_approval',
        }, { session });

        provider.providerKitCompleted = true;
        provider.accessoriesPurchased = true;
        provider.onboardingCompleted = true;
        provider.kitPurchased = true;
        provider.kitPurchasedAt = now;
        provider.kitOrderId = dbOrderId;
        await provider.save({ session });
      });
    } finally {
      await session.endSession();
    }

    res.json({ success: true, message: 'Onboarding completed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/providers/onboarding/skip
// Skip payment and mark onboarding complete (if kit allows it)
// ─────────────────────────────────────────────────────────────────────────────
export const skipOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const kit = await StarterKit.findOne({ status: 'active', isDeleted: false }).lean();

    // If payment is mandatory, deny skip (unless admin overrides)
    if (kit?.paymentMandatory && !kit?.allowRegistrationWithoutPayment) {
      res.status(403).json({ message: 'Payment is mandatory for onboarding. Please complete payment to proceed.' });
      return;
    }

    // Record a skipped order for audit trail
    await ProviderOrder.findOneAndUpdate(
      { provider_id: provider._id },
      {
        provider_id: provider._id,
        kit: kit
          ? { kit_id: kit._id, kit_name: kit.name, price: kit.price, gst: kit.gst, delivery: kit.delivery, convenience: kit.convenience }
          : { kit_id: provider._id, kit_name: 'Skipped', price: 0, gst: 0, delivery: 0, convenience: 0 },
        accessories: [],
        subtotal: 0,
        gst_amount: 0,
        grand_total: 0,
        payment_status: 'skipped',
      },
      { upsert: true, new: true }
    );

    // Do NOT set onboardingCompleted = true when skipped so provider is reminded on next login
    await provider.save();

    res.json({ success: true, message: 'Onboarding skipped temporarily for this session' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
