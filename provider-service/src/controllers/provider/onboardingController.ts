import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { ProviderRepository } from '../../repositories/providerRepository';
import { ProviderServiceRepository } from '../../repositories/providerServiceRepository';
import { getCatalogBatch, getUsersBatch } from '../../utils/internalApi';
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
      `SELECT * FROM provider.starter_kits WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
    );
    const kit = kitRes.rows[0];
    if (!kit) {
      res.status(404).json({ message: 'No active starter kit found' });
      return;
    }

    const items = typeof kit.items === 'string' ? JSON.parse(kit.items) : (kit.items || []);
    const sizes = typeof kit.sizes === 'string' ? JSON.parse(kit.sizes) : (kit.sizes || []);
    const images = typeof kit.images === 'string' ? JSON.parse(kit.images) : (kit.images || {});

    res.json({
      ...kit,
      _id: kit.id,
      id: kit.id,
      name: kit.name || 'Provider Starter Kit',
      description: kit.description || '',
      price: Number(kit.price) || 0,
      gst: Number(kit.gst) || 18,
      delivery: Number(kit.delivery) || 0,
      convenience: Number(kit.convenience) || 0,
      estimatedDays: kit.estimated_days ?? kit.estimatedDays ?? 3,
      shippingPartner: kit.shipping_partner || kit.shippingPartner || 'Courier',
      enableLiveTracking: kit.enable_live_tracking ?? kit.enableLiveTracking ?? true,
      paymentMandatory: kit.payment_mandatory ?? kit.paymentMandatory ?? true,
      allowRegistrationWithoutPayment: kit.allow_registration_without_payment ?? kit.allowRegistrationWithoutPayment ?? false,
      autoActivateAfterPayment: kit.auto_activate_after_payment ?? kit.autoActivateAfterPayment ?? true,
      requireAdminApproval: kit.require_admin_approval ?? kit.requireAdminApproval ?? false,
      items,
      sizes,
      images,
    });
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

    // 1. Provider application must already be approved by admin
    if (provider.onboarding_status !== 'APPROVED') {
      res.status(403).json({
        success: false,
        code: 'PROVIDER_NOT_APPROVED',
        message: 'Provider application must be approved by admin before kit payment can be processed.'
      });
      return;
    }

    // 2. Starter kit already collected lock
    if (provider.kit_collection_status === 'COLLECTED') {
      res.status(400).json({
        success: false,
        code: 'KIT_ALREADY_COMPLETED',
        message: 'Your starter kit has already been paid for and collected.'
      });
      return;
    }

    // 3. Starter kit already paid lock
    if (provider.kit_payment_status === 'PAID') {
      res.status(400).json({
        success: false,
        code: 'KIT_ALREADY_PAID',
        message: 'Starter kit payment has already been completed. Please collect your kit at the hub.'
      });
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

    const idempotencyKey = String(
      req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body?.idempotency_key || ''
    ).trim();

    // 1. Idempotency Check by Header / Key
    if (idempotencyKey) {
      const existingKeyOrder = await db.query(
        `SELECT * FROM provider.provider_orders 
         WHERE provider_id = $1 AND idempotency_key = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [provider.id, idempotencyKey]
      );
      if (existingKeyOrder.rows.length > 0) {
        const order = existingKeyOrder.rows[0];
        res.status(200).json({
          success: true,
          orderId: order.razorpay_order_id,
          amount: Math.round(Number(order.total_amount) * 100),
          currency: order.currency || 'INR',
          dbOrderId: order.id,
          breakdown: {
            kitBase,
            kitGst: kitGstAmount,
            delivery,
            convenience,
            accSubtotal,
            accGst,
            grandTotal: Number(order.total_amount),
          },
        });
        return;
      }
    }

    // 2. Double-Click / Retry Protection: Reuse recent pending order (<15 min) with same amount
    const recentPendingOrder = await db.query(
      `SELECT * FROM provider.provider_orders 
       WHERE provider_id = $1 
         AND order_type = 'starter_kit' 
         AND status = 'pending' 
         AND total_amount = $2 
         AND razorpay_order_id IS NOT NULL 
         AND created_at > NOW() - INTERVAL '15 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [provider.id, grandTotal]
    );

    if (recentPendingOrder.rows.length > 0) {
      const order = recentPendingOrder.rows[0];
      res.status(200).json({
        success: true,
        orderId: order.razorpay_order_id,
        amount: Math.round(Number(order.total_amount) * 100),
        currency: order.currency || 'INR',
        dbOrderId: order.id,
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
      return;
    }

    // Delete older stale pending orders
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
         provider_id, order_type, items, total_amount, currency, status, idempotency_key, razorpay_order_id
       ) VALUES ($1, 'starter_kit', $2::jsonb, $3, 'INR', 'pending', $4, $5)
       RETURNING *`,
      [provider.id, JSON.stringify(itemsPayload), grandTotal, idempotencyKey || null, rzpOrder.id]
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
  const db = getDb();
  const client = await db.connect();

  try {
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    // Provider application must already be approved by admin
    if (provider.onboarding_status !== 'APPROVED') {
      res.status(403).json({
        success: false,
        code: 'PROVIDER_NOT_APPROVED',
        message: 'Provider application must be approved by admin before kit payment can be processed.'
      });
      return;
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId } = req.body;

    if (!dbOrderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ message: 'Missing required payment verification parameters' });
      return;
    }

    await client.query('BEGIN');

    // 1. Acquire row lock on provider to serialize concurrent verification calls
    const pRes = await client.query(
      `SELECT * FROM provider.providers WHERE id = $1 FOR UPDATE`,
      [provider.id]
    );
    const curProvider = pRes.rows[0];

    // Permanent lock: if already collected, kit payment is completely done
    if (curProvider.kit_collection_status === 'COLLECTED') {
      await client.query('COMMIT');
      res.status(400).json({
        success: false,
        code: 'KIT_ALREADY_COMPLETED',
        message: 'Your starter kit has already been paid for and collected.',
        kit_collection_id: curProvider.kit_collection_id,
        kit_collection_status: 'COLLECTED',
        kit_collected_at: curProvider.kit_collected_at
      });
      return;
    }

    // 2. Idempotency Check: if already paid (retry / double-click / webhook replay), return existing result
    if (curProvider.kit_payment_status === 'PAID') {
      await client.query('COMMIT');
      res.status(200).json({
        success: true,
        message: 'Starter kit payment is already verified',
        kit_payment_status: 'PAID',
        kit_payment_id: curProvider.kit_payment_id || razorpay_payment_id,
        kit_payment_date: curProvider.kit_payment_date,
        kit_collection_id: curProvider.kit_collection_id,
        kit_collection_status: curProvider.kit_collection_status || 'PENDING'
      });
      return;
    }

    // 3. Verify order exists and belongs to this provider
    const orderRes = await client.query(
      `SELECT * FROM provider.provider_orders 
       WHERE (id::text = $1 OR legacy_mongo_id = $1) 
         AND provider_id = $2 
         AND order_type = 'starter_kit'
       FOR UPDATE`,
      [dbOrderId, provider.id]
    );

    const order = orderRes.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Starter kit order not found or does not belong to this provider' });
      return;
    }

    // 4. Verify cryptographic signature from Razorpay
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const generated = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated !== razorpay_signature) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'Payment signature verification failed' });
      return;
    }

    // 5. Update order status to paid and attach razorpay payment ID
    await client.query(
      `UPDATE provider.provider_orders
       SET status = 'paid',
           razorpay_payment_id = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [razorpay_payment_id, order.id]
    );

    // 6. Fetch current hub settings for immutable snapshot at payment time
    const settingsRes = await client.query(
      `SELECT location_name, collection_address, contact_person, contact_number, collection_instructions, operating_hours
       FROM provider.kit_collection_settings ORDER BY created_at ASC LIMIT 1`
    );
    const hubSnapshot = settingsRes.rows[0] || null;

    // 7. Generate unique collection ID once and preserve if already set
    const collectionId = curProvider.kit_collection_id || `BC-KIT-${Math.floor(100000 + Math.random() * 900000)}`;

    // 8. Update provider row with PAID status, Collection ID, and Hub snapshot
    await client.query(
      `UPDATE provider.providers
       SET kit_payment_status = 'PAID',
           kit_payment_id = $1,
           kit_payment_date = NOW(),
           kit_collection_id = COALESCE(kit_collection_id, $2),
           kit_collection_status = CASE WHEN kit_collection_status = 'COLLECTED' THEN 'COLLECTED' ELSE 'PENDING' END,
           kit_collection_hub_snapshot = COALESCE(kit_collection_hub_snapshot, $3::jsonb),
           onboarding_step = GREATEST(COALESCE(onboarding_step, 0), 4),
           updated_at = NOW()
       WHERE id = $4`,
      [razorpay_payment_id, collectionId, hubSnapshot ? JSON.stringify(hubSnapshot) : null, provider.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Provider kit payment verified successfully',
      kit_payment_status: 'PAID',
      kit_payment_id: razorpay_payment_id,
      kit_payment_date: new Date(),
      kit_collection_id: collectionId,
      kit_collection_status: 'PENDING'
    });
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // rollback catch
    }
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
};

// GET /api/providers/onboarding/kit-collection
export const getKitCollectionDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    // Use immutable assigned hub snapshot if present; otherwise fall back to live hub settings
    const snapshot = provider.kit_collection_hub_snapshot;
    let settings = snapshot && snapshot.location_name ? snapshot : null;

    if (!settings) {
      const settingsRes = await db.query(
        `SELECT location_name, collection_address, contact_person, contact_number, collection_instructions, operating_hours
         FROM provider.kit_collection_settings ORDER BY created_at ASC LIMIT 1`
      );
      settings = settingsRes.rows[0] || {
        location_name: 'BharatClap Bengaluru Central Hub',
        collection_address: 'BharatClap Regional Center, 4th Floor, 80 Feet Road, Koramangala 4th Block, Bengaluru, Karnataka 560034',
        contact_person: 'Kit Distribution & Ops Team',
        contact_number: '+91 98765 43210',
        collection_instructions: 'Please carry your original Aadhaar card / Government ID and present your Unique Collection ID at the reception counter. Kit verification and handover takes approximately 5-10 minutes.',
        operating_hours: 'Mon - Sat: 10:00 AM - 6:00 PM'
      };
    }

    const users = await getUsersBatch([provider.user_id]).catch(() => []);
    const user = users[0] || (req.user ? { name: req.user.name, phone: (req.user as any).phone || '' } : null);

    // If kit is paid but kit_collection_id is not yet generated, generate it now
    let collectionId = provider.kit_collection_id;
    let collectionStatus = provider.kit_collection_status;
    if (provider.kit_payment_status === 'PAID' && !collectionId) {
      collectionId = `BC-KIT-${Math.floor(100000 + Math.random() * 900000)}`;
      collectionStatus = 'PENDING';
      await db.query(
        `UPDATE provider.providers 
         SET kit_collection_id = $1, 
             kit_collection_status = COALESCE(NULLIF(kit_collection_status, 'NOT_APPLICABLE'), 'PENDING')
         WHERE id = $2`,
        [collectionId, provider.id]
      );
    }

    res.json({
      collection_id: collectionId || null,
      collection_status: collectionStatus || 'NOT_APPLICABLE',
      collected_at: provider.kit_collected_at || null,
      collected_by_name: provider.kit_collected_by_name || null,
      kit_payment_status: provider.kit_payment_status || 'PENDING',
      kit_payment_date: provider.kit_payment_date || null,
      access_status: provider.access_status || 'PENDING',
      settings,
      provider: {
        id: provider.id,
        name: user?.name || 'Partner',
        phone: user?.phone || ''
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/providers/access-plan
export const selectAccessPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    if (provider.onboarding_status !== 'APPROVED') {
      res.status(403).json({
        success: false,
        code: 'PROVIDER_NOT_APPROVED',
        message: 'Provider application must be approved first'
      });
      return;
    }

    if (provider.kit_payment_status !== 'PAID') {
      res.status(403).json({
        success: false,
        code: 'KIT_PAYMENT_REQUIRED',
        message: 'Provider Kit payment must be completed before choosing an access plan'
      });
      return;
    }

    if (provider.kit_collection_status !== 'COLLECTED') {
      res.status(403).json({
        success: false,
        code: 'KIT_COLLECTION_REQUIRED',
        message: 'Provider Kit must be collected from the hub before selecting an access plan.'
      });
      return;
    }

    const { plan_type } = req.body;
    const type = plan_type === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'FREE';
    const mode = type === 'SUBSCRIPTION' ? 'subscription' : 'free';

    await db.query(
      `UPDATE provider.providers
       SET access_type = $1,
           access_status = 'ACTIVE',
           access_mode = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [type, mode, provider.id]
    );

    res.json({
      success: true,
      message: `${type} access plan activated successfully`,
      access_type: type,
      access_status: 'ACTIVE',
    });
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
