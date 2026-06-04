import { Request, Response } from 'express';
import { Review } from '../models/Review';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose, { Schema } from 'mongoose';

// Decoupled Connections
let authConnection: mongoose.Connection | null = null;
let catalogConnection: mongoose.Connection | null = null;
let providerConnection: mongoose.Connection | null = null;

let UserModel: any = null;
let ServiceModel: any = null;
let ProviderModel: any = null;

const getAuthDb = () => {
  if (!authConnection) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    authConnection = mongoose.createConnection(authDbURI);
  }
  return authConnection;
};

const getCatalogDb = () => {
  if (!catalogConnection) {
    const catalogDbURI = process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db';
    catalogConnection = mongoose.createConnection(catalogDbURI);
  }
  return catalogConnection;
};

const getProviderDb = () => {
  if (!providerConnection) {
    const providerDbURI = process.env.PROVIDER_DB_URI || 'mongodb://localhost:27017/provider_db';
    providerConnection = mongoose.createConnection(providerDbURI);
  }
  return providerConnection;
};

const getUserModel = () => {
  if (!UserModel) {
    UserModel = getAuthDb().model('User', new Schema({}, { strict: false }), 'users');
  }
  return UserModel;
};

const getServiceModel = () => {
  if (!ServiceModel) {
    ServiceModel = getCatalogDb().model('Service', new Schema({}, { strict: false }), 'services');
  }
  return ServiceModel;
};

const getProviderModel = () => {
  if (!ProviderModel) {
    ProviderModel = getProviderDb().model('Provider', new Schema({}, { strict: false }), 'providers');
  }
  return ProviderModel;
};

const populateReviews = async (reviews: any[]) => {
  if (!reviews || reviews.length === 0) return [];

  const userIds = reviews.map(r => r.user_id).filter(Boolean);
  const serviceIds = reviews.map(r => r.service_id).filter(Boolean);

  const UModel = getUserModel();
  const SModel = getServiceModel();
  
  const [users, services] = await Promise.all([
    UModel.find({ _id: { $in: userIds } }).select('name profile_image').lean(),
    SModel.find({ _id: { $in: serviceIds } }).select('service_name').lean()
  ]);

  const userMap = new Map(users.map((u: any) => [String(u._id), u]));
  const serviceMap = new Map(services.map((s: any) => [String(s._id), s]));

  return reviews.map(r => ({
    ...r,
    user_id: userMap.get(String(r.user_id)) || r.user_id,
    service_id: serviceMap.get(String(r.service_id)) || r.service_id
  }));
};

// @desc    Get reviews for a provider
// @route   GET /api/reviews/provider/:providerId
// @access  Public
export const getProviderReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const reviews = await Review.find({ provider_id: new mongoose.Types.ObjectId(req.params.providerId) })
      .sort({ createdAt: -1 })
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
      booking_id: new mongoose.Types.ObjectId(booking_id as string),
      user_id: new mongoose.Types.ObjectId(req.user?._id),
      provider_id: new mongoose.Types.ObjectId(provider_id as string),
      service_id: new mongoose.Types.ObjectId(service_id as string),
      subservice_id: new mongoose.Types.ObjectId(subservice_id as string),
      rating,
      comment
    });

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
// @route   GET /api/reviews/me
// @access  Private/Provider
export const getMyReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const PModel = getProviderModel();
    const provider = await PModel.findOne({ user_id: new mongoose.Types.ObjectId(req.user?._id) }).lean();
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const reviews = await Review.find({ provider_id: provider._id })
      .sort({ createdAt: -1 })
      .lean();

    const populated = await populateReviews(reviews);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
