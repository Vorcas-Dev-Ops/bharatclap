import { Request, Response } from 'express';
import { Waiver } from '../models/Waiver';

export const grantWaiver = async (req: Request, res: Response) => {
  try {
    const { providerId, providerName, waiverType, amount, reason } = req.body;
    
    if (!providerId || !providerName || !waiverType || amount === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const waiver = new Waiver({
      providerId,
      providerName,
      waiverType,
      amount,
      reason,
      status: 'active'
    });

    await waiver.save();
    res.status(201).json(waiver);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

export const getWaivers = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const waivers = await Waiver.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    res.json(waivers);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};
