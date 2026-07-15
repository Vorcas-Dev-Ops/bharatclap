import { Request, Response } from 'express';
import { Payout } from '../models/Payout';
import { Provider } from '../models/Provider';
import { getUsersBatch } from '../utils/internalApi';

export const getAllPayouts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    // Server-side search & filtering setup
    let providerIds: any[] = [];
    if (search) {
      // Find providers matching search term by requesting auth service
      // We will perform local filtering after population if search term exists,
      // or we can resolve provider names first. Let's fetch all payouts and filter,
      // or get users by search keyword. For robustness at scale, we fetch search providers.
    }

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .populate('provider_id')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payout.countDocuments(filter)
    ]);

    const userIds = [...new Set(payouts.map((p: any) => p.provider_id?.user_id?.toString()).filter(Boolean))];
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, any>(users.map((u: any) => [String(u._id), u]));

    let processedPayouts = payouts.map((p: any) => {
      const user = p.provider_id ? userMap.get(String(p.provider_id.user_id)) : null;
      return {
        ...p,
        provider_name: user?.name || 'Unknown Provider',
      };
    });

    if (search) {
      const keyword = search.toLowerCase();
      processedPayouts = processedPayouts.filter((p: any) => 
        p.provider_name.toLowerCase().includes(keyword) || 
        p.payoutId?.toLowerCase().includes(keyword)
      );
    }

    res.status(200).json({ success: true, data: processedPayouts, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPayoutById = async (req: Request, res: Response): Promise<void> => {
  try {
    const payout = await Payout.findById(req.params.id).populate('provider_id').lean();
    if (!payout) {
      res.status(404).json({ success: false, message: 'Payout not found' });
      return;
    }

    const userId = payout.provider_id ? (payout.provider_id as any).user_id?.toString() : null;
    const users = userId ? await getUsersBatch([userId]) : [];
    const user = users.length ? users[0] : null;

    res.status(200).json({
      success: true,
      data: {
        ...payout,
        provider_name: user?.name || 'Unknown Provider',
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePayoutStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, transaction_id, payment_method, refNumber } = req.body;
    const payout = await Payout.findById(req.params.id);
    if (!payout) {
      res.status(404).json({ success: false, message: 'Payout not found' });
      return;
    }

    const current = payout.status;
    const next = status;

    let allowed = false;
    if (current === next) {
      allowed = true;
    } else if (current === 'pending' && (next === 'approved' || next === 'rejected')) {
      allowed = true;
    } else if (current === 'approved' && (next === 'processing' || next === 'rejected')) {
      allowed = true;
    } else if (current === 'processing' && (next === 'paid' || next === 'failed')) {
      allowed = true;
    } else if (current === 'failed' && next === 'processing') {
      allowed = true;
    }

    if (!allowed) {
      res.status(400).json({
        success: false,
        message: `Invalid payout status transition from ${current} to ${next}`
      });
      return;
    }

    payout.status = next;
    if (transaction_id !== undefined) payout.transaction_id = transaction_id;
    if (payment_method !== undefined) payout.payment_method = payment_method;
    if (refNumber !== undefined) payout.refNumber = refNumber;
    if (next === 'paid') payout.processedAt = new Date();

    await payout.save();

    res.status(200).json({ success: true, data: payout });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const requestPayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider_id, amount, payment_method } = req.body;
    
    const provider = await Provider.findById(provider_id);
    if (!provider) {
      res.status(404).json({ success: false, message: 'Provider not found' });
      return;
    }

    const payoutId = 'PAY-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    const payout = await Payout.create({
      payoutId,
      provider_id,
      amount,
      payment_method,
      status: 'pending'
    });

    res.status(201).json({ success: true, data: payout });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
