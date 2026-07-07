import { Request, Response } from 'express';
import { KitOrder } from '../models/KitOrder';

export const getKitOrders = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    
    const orders = await KitOrder.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
      
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

export const updateKitOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await KitOrder.findByIdAndUpdate(id, req.body, { new: true });
    if (!order) return res.status(404).json({ message: 'Not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

import crypto from 'crypto';

// For testing purposes initially
export const createDummyOrder = async (req: Request, res: Response) => {
  try {
    const order = new KitOrder({
      orderId: `KITORDER-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      providerName: 'Test Provider',
      phone: '+91 9876543210',
      address: 'Test Address, Mumbai',
      service: 'Electrician',
      size: 'L',
      amount: 895,
      payment: 'Paid',
      status: 'Pending'
    });
    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};
