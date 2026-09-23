import { Request, Response } from 'express';
import { OfferRepository } from '../repositories/offerRepository';

// @desc    Get all active offers
// @route   GET /api/offers
// @access  Public
export const getActiveOffers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const offers = await OfferRepository.findWithFilters({
      activeOnly: true,
      page,
      limit,
    });

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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const offers = await OfferRepository.findWithFilters({
      activeOnly: false,
      page,
      limit,
    });

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
    const offer = await OfferRepository.create(req.body);
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
    const offer = await OfferRepository.update(req.params.id, req.body);
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
    const success = await OfferRepository.delete(req.params.id);
    if (!success) {
      res.status(404).json({ message: 'Offer not found' });
      return;
    }
    res.json({ message: 'Offer deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
