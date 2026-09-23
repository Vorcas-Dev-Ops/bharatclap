import { Request, Response } from 'express';
import { getDb } from '../config/db';
import crypto from 'crypto';

export const getKitOrders = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const pool = getDb();

    const [ordersRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ko.*, sk.name AS kit_name, sk.price AS kit_price, p.provider_code
         FROM provider.kit_orders ko
         LEFT JOIN provider.starter_kits sk ON sk.id = ko.kit_id
         LEFT JOIN provider.providers p ON p.id = ko.provider_id
         ORDER BY ko.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM provider.kit_orders`)
    ]);

    const total = Number(countRes.rows[0]?.count) || 0;
    const orders = ordersRes.rows.map(r => ({
      _id: r.id,
      id: r.id,
      provider_id: r.provider_id,
      kit_id: r.kit_id,
      status: r.status,
      kit_name: r.kit_name,
      kit_price: Number(r.kit_price) || 0,
      provider_code: r.provider_code,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json({ data: orders, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

export const updateKitOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const pool = getDb();

    const result = await pool.query(
      `UPDATE provider.kit_orders
       SET status = COALESCE($1, status), updated_at = NOW()
       WHERE id::text = $2 OR legacy_mongo_id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found' });
    const r = result.rows[0];
    res.json({
      _id: r.id,
      id: r.id,
      provider_id: r.provider_id,
      kit_id: r.kit_id,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

// For testing purposes
export const createDummyOrder = async (req: Request, res: Response) => {
  try {
    const pool = getDb();
    // Find any provider and any kit to link
    const pRes = await pool.query(`SELECT id FROM provider.providers LIMIT 1`);
    const kRes = await pool.query(`SELECT id FROM provider.starter_kits LIMIT 1`);

    if (pRes.rowCount === 0 || kRes.rowCount === 0) {
      return res.status(400).json({ message: 'Missing provider or starter kit' });
    }

    const result = await pool.query(
      `INSERT INTO provider.kit_orders (
         provider_id, kit_id, status
       ) VALUES ($1, $2, 'pending')
       RETURNING *`,
      [pRes.rows[0].id, kRes.rows[0].id]
    );

    const r = result.rows[0];
    res.status(201).json({
      _id: r.id,
      id: r.id,
      orderId: `KITORDER-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      provider_id: r.provider_id,
      kit_id: r.kit_id,
      status: r.status,
      createdAt: r.created_at
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};
