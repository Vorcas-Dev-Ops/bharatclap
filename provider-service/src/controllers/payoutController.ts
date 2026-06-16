import { Request, Response } from 'express';
import { Payout } from '../models/Payout';
import { Provider } from '../models/Provider';
import { getUsersBatch } from '../utils/internalApi';

export const getAllPayouts = async (req: Request, res: Response): Promise<void> => {
  try {
    const payouts = await Payout.find()
      .populate('provider_id')
      .sort({ createdAt: -1 })
      .lean();

    const userIds = [...new Set(payouts.map((p: any) => p.provider_id?.user_id?.toString()).filter(Boolean))];
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, any>(users.map((u: any) => [String(u._id), u]));

    const processedPayouts = payouts.map((p: any) => {
      const user = p.provider_id ? userMap.get(String(p.provider_id.user_id)) : null;
      return {
        ...p,
        provider_name: user?.name || 'Unknown Provider',
      };
    });

    res.status(200).json({ success: true, data: processedPayouts });
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

    const payout = await Payout.create({
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
