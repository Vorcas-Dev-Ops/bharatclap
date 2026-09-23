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
      items: r.items || [],
      price: Number(r.price),
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
    const { name, items, price, currency } = req.body;
    const pool = getDb();

    const result = await pool.query(
      `INSERT INTO provider.starter_kits (
         name, items, price, currency, status
       ) VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [name || 'Starter Kit', JSON.stringify(items || []), Number(price) || 0, currency || 'INR']
    );

    const r = result.rows[0];
    res.status(201).json({
      _id: r.id,
      id: r.id,
      name: r.name,
      items: r.items,
      price: Number(r.price),
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
    const items = updateData.items !== undefined ? JSON.stringify(updateData.items) : JSON.stringify(current.items);
    const price = updateData.price !== undefined ? Number(updateData.price) : Number(current.price);
    const status = updateData.status !== undefined ? updateData.status : current.status;

    const result = await pool.query(
      `UPDATE provider.starter_kits
       SET name = $1, items = $2, price = $3, status = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, items, price, status, current.id]
    );

    const r = result.rows[0];
    res.json({
      _id: r.id,
      id: r.id,
      name: r.name,
      items: r.items,
      price: Number(r.price),
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
