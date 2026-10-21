import { Request, Response } from 'express';
import { getDb } from '../config/db';
import { saveFileToCloud } from '../utils/fileHelper';

export const getStarterKits = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const pool = getDb();

    const result = await pool.query(
      `SELECT * FROM provider.starter_kits
       WHERE status != 'deleted'
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const mapped = result.rows.map(r => ({
      _id: r.id,
      id: r.id,
      name: r.name,
      description: r.description || '',
      items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
      sizes: typeof r.sizes === 'string' ? JSON.parse(r.sizes) : (r.sizes || []),
      price: Number(r.price) || 0,
      gst: Number(r.gst) || 18,
      delivery: Number(r.delivery) || 0,
      convenience: Number(r.convenience) || 0,
      estimatedDays: r.estimated_days ?? 3,
      shippingPartner: r.shipping_partner || 'Delhivery',
      enableLiveTracking: r.enable_live_tracking ?? true,
      paymentMandatory: r.payment_mandatory ?? true,
      allowRegistrationWithoutPayment: r.allow_registration_without_payment ?? false,
      autoActivateAfterPayment: r.auto_activate_after_payment ?? true,
      requireAdminApproval: r.require_admin_approval ?? false,
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || {}),
      currency: r.currency || 'INR',
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

export const createStarterKit = async (req: Request, res: Response) => {
  try {
    const {
      name, description, items, sizes, price, gst, delivery, convenience,
      estimatedDays, shippingPartner, enableLiveTracking,
      paymentMandatory, allowRegistrationWithoutPayment, autoActivateAfterPayment,
      requireAdminApproval, images, currency
    } = req.body;
    const pool = getDb();

    const result = await pool.query(
      `INSERT INTO provider.starter_kits (
         name, description, items, sizes, price, gst, delivery, convenience,
         estimated_days, shipping_partner, enable_live_tracking,
         payment_mandatory, allow_registration_without_payment, auto_activate_after_payment,
         require_admin_approval, images, currency, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'active')
       RETURNING *`,
      [
        name || 'Starter Kit',
        description || '',
        JSON.stringify(items || []),
        JSON.stringify(sizes || []),
        Number(price) || 0,
        Number(gst) || 18,
        Number(delivery) || 0,
        Number(convenience) || 0,
        Number(estimatedDays) || 3,
        shippingPartner || 'Delhivery',
        enableLiveTracking ?? true,
        paymentMandatory ?? true,
        allowRegistrationWithoutPayment ?? false,
        autoActivateAfterPayment ?? true,
        requireAdminApproval ?? false,
        JSON.stringify(images || {}),
        currency || 'INR'
      ]
    );

    const r = result.rows[0];
    res.status(201).json({
      _id: r.id,
      id: r.id,
      name: r.name,
      description: r.description,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
      sizes: typeof r.sizes === 'string' ? JSON.parse(r.sizes) : (r.sizes || []),
      price: Number(r.price),
      gst: Number(r.gst),
      delivery: Number(r.delivery),
      convenience: Number(r.convenience),
      estimatedDays: r.estimated_days,
      shippingPartner: r.shipping_partner,
      enableLiveTracking: r.enable_live_tracking,
      paymentMandatory: r.payment_mandatory,
      allowRegistrationWithoutPayment: r.allow_registration_without_payment,
      autoActivateAfterPayment: r.auto_activate_after_payment,
      requireAdminApproval: r.require_admin_approval,
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || {}),
      currency: r.currency,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

export const updateStarterKit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };

    if (updateData.images) {
      const slots = ['banner', 'tshirt', 'bag', 'idcard', 'kit'];
      for (const slot of slots) {
        if (updateData.images[slot] && updateData.images[slot].startsWith('data:image')) {
          const uploadRes = await saveFileToCloud(updateData.images[slot], 'starter-kits');
          updateData.images[slot] = uploadRes.secure_url;
        }
      }
    }

    const pool = getDb();
    const existing = await pool.query(
      `SELECT * FROM provider.starter_kits WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'Not found' });
    }

    const current = existing.rows[0];
    const name = updateData.name !== undefined ? updateData.name : current.name;
    const description = updateData.description !== undefined ? updateData.description : current.description;
    const items = updateData.items !== undefined ? JSON.stringify(updateData.items) : (typeof current.items === 'string' ? current.items : JSON.stringify(current.items || []));
    const sizes = updateData.sizes !== undefined ? JSON.stringify(updateData.sizes) : (typeof current.sizes === 'string' ? current.sizes : JSON.stringify(current.sizes || []));
    const price = updateData.price !== undefined ? Number(updateData.price) : Number(current.price);
    const gst = updateData.gst !== undefined ? Number(updateData.gst) : Number(current.gst || 18);
    const delivery = updateData.delivery !== undefined ? Number(updateData.delivery) : Number(current.delivery || 0);
    const convenience = updateData.convenience !== undefined ? Number(updateData.convenience) : Number(current.convenience || 0);
    const estimatedDays = updateData.estimatedDays !== undefined ? Number(updateData.estimatedDays) : (current.estimated_days ?? 3);
    const shippingPartner = updateData.shippingPartner !== undefined ? updateData.shippingPartner : (current.shipping_partner || 'Delhivery');
    const enableLiveTracking = updateData.enableLiveTracking !== undefined ? updateData.enableLiveTracking : (current.enable_live_tracking ?? true);
    const paymentMandatory = updateData.paymentMandatory !== undefined ? updateData.paymentMandatory : (current.payment_mandatory ?? true);
    const allowRegistrationWithoutPayment = updateData.allowRegistrationWithoutPayment !== undefined ? updateData.allowRegistrationWithoutPayment : (current.allow_registration_without_payment ?? false);
    const autoActivateAfterPayment = updateData.autoActivateAfterPayment !== undefined ? updateData.autoActivateAfterPayment : (current.auto_activate_after_payment ?? true);
    const requireAdminApproval = updateData.requireAdminApproval !== undefined ? updateData.requireAdminApproval : (current.require_admin_approval ?? false);
    const images = updateData.images !== undefined ? JSON.stringify(updateData.images) : (typeof current.images === 'string' ? current.images : JSON.stringify(current.images || {}));
    const status = updateData.status !== undefined ? updateData.status : current.status;

    const result = await pool.query(
      `UPDATE provider.starter_kits
       SET name = $1, description = $2, items = $3, sizes = $4, price = $5,
           gst = $6, delivery = $7, convenience = $8, estimated_days = $9,
           shipping_partner = $10, enable_live_tracking = $11, payment_mandatory = $12,
           allow_registration_without_payment = $13, auto_activate_after_payment = $14,
           require_admin_approval = $15, images = $16, status = $17, updated_at = NOW()
       WHERE id = $18
       RETURNING *`,
      [
        name, description, items, sizes, price,
        gst, delivery, convenience, estimatedDays,
        shippingPartner, enableLiveTracking, paymentMandatory,
        allowRegistrationWithoutPayment, autoActivateAfterPayment,
        requireAdminApproval, images, status, current.id
      ]
    );

    const r = result.rows[0];
    res.json({
      _id: r.id,
      id: r.id,
      name: r.name,
      description: r.description,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
      sizes: typeof r.sizes === 'string' ? JSON.parse(r.sizes) : (r.sizes || []),
      price: Number(r.price),
      gst: Number(r.gst),
      delivery: Number(r.delivery),
      convenience: Number(r.convenience),
      estimatedDays: r.estimated_days,
      shippingPartner: r.shipping_partner,
      enableLiveTracking: r.enable_live_tracking,
      paymentMandatory: r.payment_mandatory,
      allowRegistrationWithoutPayment: r.allow_registration_without_payment,
      autoActivateAfterPayment: r.auto_activate_after_payment,
      requireAdminApproval: r.require_admin_approval,
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || {}),
      currency: r.currency,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

export const deleteStarterKit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getDb();
    const result = await pool.query(
      `UPDATE provider.starter_kits
       SET status = 'deleted', updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found' });
    const r = result.rows[0];
    res.json({
      message: 'Starter kit soft deleted successfully',
      kit: {
        _id: r.id,
        id: r.id,
        name: r.name,
        status: r.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};
