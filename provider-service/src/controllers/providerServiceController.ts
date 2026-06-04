import { Request, Response } from 'express';
import { ProviderService } from '../models/ProviderService';
import { Provider } from '../models/Provider';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose, { Schema } from 'mongoose';
import { saveFileToCloud } from '../utils/fileHelper';

interface ResolvedUser {
  _id: string;
  name: string;
  email: string;
}

interface ResolvedSubService {
  _id: string;
  subservice_name: string;
}

// Lazy-loaded connections to other DBs for manual joins
let authConnection: mongoose.Connection | null = null;
let catalogConnection: mongoose.Connection | null = null;

let UserModel: any = null;
let SubServiceModel: any = null;
let ServiceModel: any = null;

const getUserModel = () => {
  if (!UserModel) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    authConnection = mongoose.createConnection(authDbURI);

    const userSchema = new Schema({
      name: { type: String, required: true },
      email: { type: String, required: true }
    }, { strict: false });

    UserModel = authConnection.model('User', userSchema, 'users');
  }
  return UserModel;
};

const getSubServiceModel = () => {
  if (!SubServiceModel) {
    const catalogDbURI = process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db';
    catalogConnection = mongoose.createConnection(catalogDbURI);

    const subserviceSchema = new Schema({
      subservice_name: { type: String, required: true },
      service_id: { type: Schema.Types.ObjectId, required: true }
    }, { strict: false });

    SubServiceModel = catalogConnection.model('SubService', subserviceSchema, 'subservices');
  }
  return SubServiceModel;
};

const getServiceModel = () => {
  if (!ServiceModel) {
    const catalogDbURI = process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db';
    if (!catalogConnection) {
      catalogConnection = mongoose.createConnection(catalogDbURI);
    }

    const serviceSchema = new Schema({
      category_id: { type: Schema.Types.ObjectId, required: true },
    }, { strict: false });

    ServiceModel = catalogConnection.model('Service', serviceSchema, 'services');
  }
  return ServiceModel;
};


// @desc    Add service to provider profile
// @route   POST /api/provider-services
// @access  Private/Provider
export const addProviderService = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      provider_id,
      experience,
      price,
      discount,
      final_price,
      location_ids,
      subservice_ids,
      documents,
      is_featured,
      is_available
    } = req.body;

    if (experience === undefined || experience === null) {
      res.status(400).json({ message: 'Experience is required.' });
      return;
    }

    if (!price) {
      res.status(400).json({ message: 'Price is required.' });
      return;
    }

    // Enforce max 2 categories per provider
    const existingServices = await ProviderService.find({
      provider_id: new mongoose.Types.ObjectId(provider_id as string),
      isDeleted: false
    });

    const allSubserviceIds = [
      ...existingServices.flatMap(s => s.subservice_ids),
      ...(subservice_ids || []).map((id: string) => new mongoose.Types.ObjectId(id))
    ];

    if (allSubserviceIds.length > 0) {
      const SubModel = getSubServiceModel();
      const SModel = getServiceModel();

      const subservices = await SubModel.find({ _id: { $in: allSubserviceIds } }).select('service_id').lean();
      const serviceIds = subservices.map((s: any) => s.service_id);

      const services = await SModel.find({ _id: { $in: serviceIds } }).select('category_id').lean();
      const categoryIds = services.map((s: any) => String(s.category_id));

      const uniqueCategoryIds = new Set(categoryIds);
      if (uniqueCategoryIds.size > 2) {
        res.status(400).json({ message: 'A provider can offer services in a maximum of 2 categories.' });
        return;
      }
    }


    const processedDocs = [];
    if (Array.isArray(documents)) {
      for (const doc of documents) {
        if (doc.file_url && doc.file_url.startsWith('data:')) {
          const cloudRes = await saveFileToCloud(doc.file_url, 'services/docs');
          if (typeof cloudRes === 'object') {
            processedDocs.push({
              ...doc,
              file_url: cloudRes.secure_url,
              public_id: cloudRes.public_id,
              resource_type: cloudRes.resource_type
            });
          } else {
            processedDocs.push({ ...doc, file_url: cloudRes });
          }
        } else {
          processedDocs.push(doc);
        }
      }
    }

    const providerService = await ProviderService.create({
      provider_id: new mongoose.Types.ObjectId(provider_id as string),
      experience,
      price,
      discount: discount || 0,
      final_price: final_price || price,
      location_ids: location_ids || [],
      subservice_ids: subservice_ids || [],
      documents: processedDocs,
      is_featured: is_featured || false,
      is_available: is_available ?? true,
      is_active: true,
      isDeleted: false
    });

    res.status(201).json(providerService);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all provider services (Admin)
// @route   GET /api/provider-services
// @access  Private/Admin
export const getAllProviderServices = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const services = await ProviderService.find({
      isDeleted: false,
    }).lean();

    const providerIds = services.map(s => s.provider_id);
    const providers = await Provider.find({ _id: { $in: providerIds } }).lean();
    const providerMap = new Map(providers.map(p => [String(p._id), p]));

    const userIds = providers.map(p => p.user_id);
    const UModel = getUserModel();
    const users = await UModel.find({ _id: { $in: userIds } }).select('name email').lean();
    const userMap = new Map<string, ResolvedUser>(users.map((u: any) => [String(u._id), u as ResolvedUser]));

    const result = services.map(s => {
      const provider = providerMap.get(String(s.provider_id));
      const user = provider ? userMap.get(String(provider.user_id)) : null;
      return {
        ...s,
        provider_id: provider ? {
          ...provider,
          user_id: user ?? provider.user_id
        } : s.provider_id
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get services of a provider
// @route   GET /api/provider-services/:providerId
// @access  Public
export const getProviderServices = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const services = await ProviderService.find({
      provider_id: new mongoose.Types.ObjectId(req.params.providerId),
      isDeleted: false
    }).lean();

    const subserviceIds = services.flatMap(s => s.subservice_ids);
    const SModel = getSubServiceModel();
    const subservices = await SModel.find({ _id: { $in: subserviceIds } }).lean();
    const subserviceMap = new Map<string, ResolvedSubService>(subservices.map((s: any) => [String(s._id), s as ResolvedSubService]));

    const result = services.map(s => ({
      ...s,
      subservice_ids: s.subservice_ids.map(id => subserviceMap.get(String(id)) || { _id: id, subservice_name: '—' })
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update provider service
// @route   PUT /api/provider-services/:id
// @access  Private/Provider
export const updateProviderService = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      price,
      discount,
      final_price,
      subservice_ids,
      is_active,
      is_available,
      is_featured
    } = req.body;

    const providerService = await ProviderService.findById(req.params.id);

    if (!providerService) {
      res.status(404).json({
        message: 'Provider service not found',
      });
      return;
    }

    if (price !== undefined) providerService.price = price;
    if (discount !== undefined) providerService.discount = discount;
    if (final_price !== undefined) providerService.final_price = final_price;
    if (subservice_ids !== undefined) providerService.subservice_ids = subservice_ids;
    if (is_featured !== undefined) providerService.is_featured = is_featured;
    if (is_available !== undefined) providerService.is_available = is_available;
    if (is_active !== undefined) providerService.is_active = is_active;

    await providerService.save();

    res.json(providerService);
  } catch (error: any) {
    res.status(400).json({
      message: error.message,
    });
  }
};

// @desc    Remove service from provider profile
// @route   DELETE /api/provider-services/:id
// @access  Private/Provider
export const deleteProviderService = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const providerService =
      await ProviderService.findById(req.params.id);

    if (!providerService) {
      res.status(404).json({
        message: 'Provider service not found',
      });
      return;
    }

    providerService.isDeleted = true;
    providerService.is_active = false;
    await providerService.save();

    res.json({ message: 'Service removed from provider' });
  } catch (error: any) {
    res.status(500).json({
      message: error.message,
    });
  }
};
