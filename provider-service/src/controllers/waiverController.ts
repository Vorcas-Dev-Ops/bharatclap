import { Request, Response } from 'express';
import { getDb } from '../config/db';

export const grantWaiver = async (req: Request, res: Response) => {
  try {
    const { providerId, waiverType, amount, reason } = req.body;
    
    if (!providerId || !waiverType || amount === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const pool = getDb();
    const result = await pool.query(
      `INSERT INTO provider.waivers (
         provider_id, waiver_type, amount, currency, reason
       ) VALUES (
         (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         $2, $3, 'INR', $4
       ) RETURNING *`,
      [providerId, waiverType, Number(amount) || 0, reason || null]
    );

    const r = result.rows[0];
    res.status(201).json({
      _id: r.id,
      id: r.id,
      providerId: r.provider_id,
      waiverType: r.waiver_type,
      amount: Number(r.amount),
      currency: r.currency,
      reason: r.reason,
      status: 'active',
      createdAt: r.created_at
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

export const getWaivers = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const pool = getDb();

    const result = await pool.query(
      `SELECT w.*, p.provider_code
       FROM provider.waivers w
       LEFT JOIN provider.providers p ON p.id = w.provider_id
       ORDER BY w.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const waivers = result.rows.map(r => ({
      _id: r.id,
      id: r.id,
      providerId: r.provider_id,
      providerCode: r.provider_code,
      waiverType: r.waiver_type,
      amount: Number(r.amount),
      currency: r.currency,
      reason: r.reason,
      status: 'active',
      createdAt: r.created_at
    }));

    res.json(waivers);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};
