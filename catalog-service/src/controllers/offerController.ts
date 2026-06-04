import { Request, Response } from 'express';
import { Offer } from '../models/Offer';

// @desc    Get all active offers
// @route   GET /api/offers
// @access  Public
export const getActiveOffers = async (req: Request, res: Response): Promise<void> => {
  try {
    const offers = await Offer.find({ 
      status: 'active',
      expiry_date: { $gte: new Date() }
    }).sort({ createdAt: -1 });
    res.json(offers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all offers (Admin)
// @route   GET /api/offers/admin
// @access  Private/Admin
export const getAllOffersAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json(offers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create offer
// @route   POST /api/offers
// @access  Private/Admin
export const createOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const offer = await Offer.create(req.body);
    res.status(201).json(offer);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update offer
// @route   PUT /api/offers/:id
// @access  Private/Admin
export const updateOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!offer) {
      res.status(404).json({ message: 'Offer not found' });
      return;
    }
    res.json(offer);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete offer
// @route   DELETE /api/offers/:id
// @access  Private/Admin
export const deleteOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) {
      res.status(404).json({ message: 'Offer not found' });
      return;
    }
    res.json({ message: 'Offer deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
