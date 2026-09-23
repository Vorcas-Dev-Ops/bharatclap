import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { ProviderRepository } from '../../repositories/providerRepository';
import { ProviderServiceRepository } from '../../repositories/providerServiceRepository';
import { getCatalogBatch } from '../../utils/internalApi';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import axios from 'axios';

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002';

const getRazorpay = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });

// GET /api/providers/onboarding/starter-kit
export const getOnboardingStarterKit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const kitRes = await db.query(
      `SELECT * FROM provider.starter_kits WHERE status = 'active' LIMIT 1`
    );
    const kit = kitRes.rows[0];
    if (!kit) {
      res.status(404).json({ message: 'No active starter kit found' });
      return;
    }
    res.json({ ...kit, _id: kit.id, price: Number(kit.price) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/providers/onboarding/accessories
export const getOnboardingAccessories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const providerServices = await ProviderServiceRepository.getServicesForProvider(provider.id);
    const subserviceIds = [...new Set(providerServices.flatMap(s => s.subservice_ids).map(String))];

    let categoryIds: string[] = [];

    if (subserviceIds.length > 0) {
      const catalogData = await getCatalogBatch(subserviceIds, [], [], []);
      const subservices = catalogData?.subservices || [];

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

    let url = `${CATALOG_SERVICE_URL}/api/accessories?status=active`;
    if (categoryIds.length > 0) {
      url += `&category=${categoryIds[0]}`;
    }

    const { data } = await axios.get(url, { timeout: 3000 }).catch(() => ({ data: [] }));
    res.json(data);
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

// POST /api/providers/onboarding/create-order
export const createOnboardingOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { kitId, kitSize, accessories } = req.body;

    const kitRes = await db.query(
      `SELECT * FROM provider.starter_kits WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [kitId]
    );
    const kit = kitRes.rows[0];
    if (!kit) {
      res.status(404).json({ message: 'Starter kit not found' });
      return;
    }

    const kitBase = Number(kit.price) || 0;
    const kitGstAmount = Math.round(kitBase * 0.18);
    const delivery = 0;
    const convenience = 0;
    const kitTotal = kitBase + kitGstAmount + delivery + convenience;

    let accSubtotal = 0;
    const accItems: IProviderOrderAccessoryItem[] = [];

    if (Array.isArray(accessories) && accessories.length > 0) {
      for (const acc of accessories) {
        const itemTotal = Number(acc.unit_price) * Number(acc.quantity);
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

    // Delete existing pending order
    await db.query(
      `DELETE FROM provider.provider_orders WHERE provider_id = $1 AND status != 'paid'`,
      [provider.id]
    );

    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: grandTotal * 100,
      currency: 'INR',
      receipt: `on_${provider.id.slice(-12)}_${Math.floor(Date.now() / 1000)}`,
    });

    const itemsPayload = {
      kit: {
        kit_id: kit.id,
        kit_name: kit.name,
        price: kitBase,
        size: kitSize,
      },
      accessories: accItems,
      razorpay_order_id: rzpOrder.id
    };

    const orderRes = await db.query(
      `INSERT INTO provider.provider_orders (
         provider_id, order_type, items, total_amount, currency, status
       ) VALUES ($1, 'starter_kit', $2::jsonb, $3, 'INR', 'pending')
       RETURNING *`,
      [provider.id, JSON.stringify(itemsPayload), grandTotal]
    );

    const providerOrder = orderRes.rows[0];

    res.status(201).json({
      success: true,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      dbOrderId: providerOrder.id,
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
    console.error('[CREATE-ORDER] Error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/providers/onboarding/verify-payment
export const verifyOnboardingPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
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

    await db.query(
      `UPDATE provider.provider_orders
       SET status = 'paid',
           updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [dbOrderId]
    );

    await db.query(
      `UPDATE provider.providers
       SET onboarding_status = 'UNDER_REVIEW',
           onboarding_step = 4,
           updated_at = NOW()
       WHERE id = $1`,
      [provider.id]
    );

    res.json({ success: true, message: 'Onboarding completed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/providers/onboarding/skip
export const skipOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    await db.query(
      `INSERT INTO provider.provider_orders (
         provider_id, order_type, items, total_amount, currency, status
       ) VALUES ($1, 'starter_kit', '{"skipped": true}'::jsonb, 0, 'INR', 'skipped')
       RETURNING *`,
      [provider.id]
    );

    res.json({ success: true, message: 'Onboarding skipped temporarily for this session' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
