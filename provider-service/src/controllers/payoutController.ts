import { Request, Response } from 'express';
import { getDb } from '../config/db';
import { ProviderRepository } from '../repositories/providerRepository';
import { getUsersBatch, sendProviderNotification } from '../utils/internalApi';

export const getAllPayouts = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      conditions.push(`py.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await db.query(
      `SELECT COUNT(*)::int as total FROM provider.payouts py ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0]?.total || 0);

    const queryParams = [...params, limit, offset];
    const dataRes = await db.query(
      `SELECT py.*, p.user_id, p.provider_code, py.amount::numeric as amount
       FROM provider.payouts py
       LEFT JOIN provider.providers p ON p.id = py.provider_id
       ${whereClause}
       ORDER BY py.created_at DESC
       LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );

    const payouts = dataRes.rows;
    const userIds = [...new Set(payouts.map((p: any) => String(p.user_id)).filter(Boolean))];
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, any>(users.map((u: any) => [String(u.id || u._id), u]));

    let processedPayouts = payouts.map((p: any) => {
      const user = p.user_id ? userMap.get(String(p.user_id)) : null;
      return {
        ...p,
        _id: p.id,
        amount: Number(p.amount),
        provider_name: user?.name || 'Unknown Provider',
      };
    });

    if (search) {
      const keyword = search.toLowerCase();
      processedPayouts = processedPayouts.filter((p: any) => 
        p.provider_name.toLowerCase().includes(keyword) || 
        (p.payout_reference && p.payout_reference.toLowerCase().includes(keyword))
      );
    }

    res.status(200).json({ success: true, data: processedPayouts, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPayoutById = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const resRow = await db.query(
      `SELECT py.*, p.user_id, p.provider_code, py.amount::numeric as amount
       FROM provider.payouts py
       LEFT JOIN provider.providers p ON p.id = py.provider_id
       WHERE py.id::text = $1 OR py.legacy_mongo_id = $1
       LIMIT 1`,
      [req.params.id]
    );

    const payout = resRow.rows[0];
    if (!payout) {
      res.status(404).json({ success: false, message: 'Payout not found' });
      return;
    }

    const userId = payout.user_id ? String(payout.user_id) : null;
    const users = userId ? await getUsersBatch([userId]) : [];
    const user = users.length ? users[0] : null;

    res.status(200).json({
      success: true,
      data: {
        ...payout,
        _id: payout.id,
        amount: Number(payout.amount),
        provider_name: user?.name || 'Unknown Provider',
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePayoutStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { status, transaction_id, payment_method, refNumber } = req.body;
    
    const findRes = await db.query(
      `SELECT py.*, p.user_id
       FROM provider.payouts py
       LEFT JOIN provider.providers p ON p.id = py.provider_id
       WHERE py.id::text = $1 OR py.legacy_mongo_id = $1
       LIMIT 1`,
      [req.params.id]
    );

    const payout = findRes.rows[0];
    if (!payout) {
      res.status(404).json({ success: false, message: 'Payout not found' });
      return;
    }

    const nextStatus = status === 'paid' ? 'completed' : status;
    const updateRes = await db.query(
      `UPDATE provider.payouts
       SET status = $2,
           payout_reference = COALESCE($3, payout_reference),
           utr = COALESCE($4, utr),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [payout.id, nextStatus, transaction_id || refNumber || null, refNumber || transaction_id || null]
    );

    const updated = updateRes.rows[0];

    if (payout.user_id) {
      const title = nextStatus === 'completed' ? 'Payout Processed' : `Payout ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}`;
      const message = nextStatus === 'completed'
        ? `Your payout of ₹${payout.amount} has been successfully processed.`
        : `Your payout request of ₹${payout.amount} status is now ${nextStatus}.`;
      sendProviderNotification(
        String(payout.user_id),
        title,
        message,
        'payment_alert',
        { payout_id: payout.id, amount: Number(payout.amount), status: nextStatus }
      ).catch(err => console.error('[NOTIFICATION] Failed to send payout notification:', err));
    }

    res.status(200).json({ success: true, data: { ...updated, _id: updated.id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const requestPayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { provider_id, amount } = req.body;
    
    const provider = await ProviderRepository.findById(String(provider_id));
    if (!provider) {
      res.status(404).json({ success: false, message: 'Provider not found' });
      return;
    }

    const payoutRef = 'PAY-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    const insertRes = await db.query(
      `INSERT INTO provider.payouts (
         provider_id, amount, payout_reference, status
       ) VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [provider.id, Number(amount), payoutRef]
    );

    const payout = insertRes.rows[0];
    res.status(201).json({ success: true, data: { ...payout, _id: payout.id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
