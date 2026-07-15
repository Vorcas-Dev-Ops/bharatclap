import { Request, Response } from 'express';
import { Review } from '../models/Review';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';
import { getUsersBatch, getCatalogBatch, getProviderByUserId, sendAdminNotification } from '../utils/internalApi';
import axios from 'axios';

const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003';

const populateReviews = async (reviews: any[]) => {
  if (!reviews || reviews.length === 0) return [];

  const userIds    = [...new Set(reviews.map(r => r.user_id?.toString()).filter(Boolean))];
  const serviceIds = [...new Set(reviews.map(r => r.service_id?.toString()).filter(Boolean))];

  const [users, catalogData] = await Promise.all([
    getUsersBatch(userIds),
    getCatalogBatch([], serviceIds, [], [])
  ]);

  const userMap    = new Map(users.map((u: any) => [String(u._id), u]));
  const serviceMap = new Map(catalogData.services.map((s: any) => [String(s._id), s]));

  return reviews.map(r => ({
    ...r,
    user_id:    userMap.get(String(r.user_id))    || r.user_id,
    service_id: serviceMap.get(String(r.service_id)) || r.service_id
  }));
};

// @desc    Get reviews for a provider
// @route   GET /api/reviews/provider/:providerId
// @access  Public
export const getProviderReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const reviews = await Review.find({ provider_id: new mongoose.Types.ObjectId(req.params.providerId) })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const populated = await populateReviews(reviews);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a review
// @route   POST /api/reviews
// @access  Private
export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id, provider_id, service_id, subservice_id, rating, comment } = req.body;

    const exists = await Review.findOne({ booking_id: new mongoose.Types.ObjectId(booking_id as string) });
    if (exists) {
      res.status(400).json({ message: 'You have already reviewed this booking' });
      return;
    }

    const review = await Review.create({
      booking_id:    new mongoose.Types.ObjectId(booking_id as string),
      user_id:       new mongoose.Types.ObjectId(req.user?._id),
      provider_id:   new mongoose.Types.ObjectId(provider_id as string),
      service_id:    new mongoose.Types.ObjectId(service_id as string),
      subservice_id: new mongoose.Types.ObjectId(subservice_id as string),
      rating,
      comment
    });

    // Aggregate average rating in MongoDB — no full collection load into Node RAM
    const ratingAgg = await Review.aggregate([
      { $match: { provider_id: new mongoose.Types.ObjectId(provider_id as string) } },
      { $group: { _id: null, avg: { $avg: '$rating' } } }
    ]);
    const avg = ratingAgg.length > 0 ? ratingAgg[0].avg : rating;
    await axios.patch(`${PROVIDER_SERVICE_URL}/api/providers/${provider_id}/rating`, { average_rating: parseFloat(avg.toFixed(1)) })
      .catch(() => { /* Fire and forget */ });

    await sendAdminNotification(
      'New Service Review',
      `A new ${rating}-star review was submitted for a service booking.`,
      'status_update',
      { review_id: review._id, booking_id, provider_id }
    );

    res.status(201).json(review);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private/Admin
export const deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      res.status(404).json({ message: 'Review not found' });
      return;
    }

    if (review.user_id.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    await review.deleteOne();
    res.json({ message: 'Review deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get my reviews (Provider)
// @route   GET /api/reviews/my
// @access  Private/Provider
export const getMyReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Use the internal by-user-ids endpoint — no Bearer token forwarding needed.
    const provider = await getProviderByUserId(req.user!._id);
    if (!provider) {
      // Provider profile doesn't exist yet — return empty list gracefully
      res.json([]);
      return;
    }
    const providerId = (provider as any)._id;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const reviews = await Review.find({ provider_id: new mongoose.Types.ObjectId(providerId) })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const populated = await populateReviews(reviews);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
