import { Request, Response } from 'express';
import { Payout } from '../models/Payout';
import { Provider } from '../models/Provider';

export const getAllPayouts = async (req: Request, res: Response): Promise<void> => {
  try {
    const payouts = await Payout.find()
      .populate('provider_id', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: payouts });
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
