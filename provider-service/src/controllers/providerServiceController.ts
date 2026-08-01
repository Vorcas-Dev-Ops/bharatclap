import { Request, Response } from 'express';
import { ProviderService } from '../models/ProviderService';
import { Provider } from '../models/Provider';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';
import { saveFileToCloud } from '../utils/fileHelper';
import { LocationAuditLog } from '../models/LocationAuditLog';
import { LocationChangeRequest } from '../models/LocationChangeRequest';

interface ResolvedUser {
  _id: string;
  name: string;
  email: string;
}

interface ResolvedSubService {
  _id: string;
  subservice_name: string;
}

import { 
  getUsersBatch, 
  getCatalogBatch,
  getLocationsBatch
} from '../utils/internalApi';

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
      const catalogData = await getCatalogBatch(allSubserviceIds.map(String), [], [], []);
      const serviceIds = catalogData.subservices.map((s: any) => String(s.service_id));
      const serviceCatalogData = await getCatalogBatch([], serviceIds, [], []);
      const categoryIds = serviceCatalogData.services.map((s: any) => String(s.category_id));

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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const filter = { isDeleted: false };

    const [services, total] = await Promise.all([
      ProviderService.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProviderService.countDocuments(filter)
    ]);

    const providerIds = services.map(s => s.provider_id);
    const providers = await Provider.find({ _id: { $in: providerIds } }).lean();
    const providerMap = new Map(providers.map(p => [String(p._id), p]));

    const userIds = [...new Set(providers.map(p => p.user_id?.toString()).filter(Boolean))];
    const users = await getUsersBatch(userIds);
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

    res.json({ data: result, total, page, limit, pages: Math.ceil(total / limit) });
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
    const { providerId } = req.params;
    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      res.json({ data: [], total: 0, page: 1, limit: 50, pages: 0 });
      return;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const filter = {
      provider_id: new mongoose.Types.ObjectId(providerId),
      isDeleted: false
    };

    const [services, total] = await Promise.all([
      ProviderService.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProviderService.countDocuments(filter)
    ]);

    const subserviceIds = [...new Set(services.flatMap(s => (s.subservice_ids || []).map((id: any) => String(id._id || id))))];
    const catalogData = subserviceIds.length > 0 ? await getCatalogBatch(subserviceIds, [], [], []) : { subservices: [] };
    const subserviceMap = new Map<string, ResolvedSubService>((catalogData?.subservices || []).map((s: any) => [String(s._id), s as ResolvedSubService]));

    const providerDoc = await Provider.findById(providerId).lean();
    const fallbackLocations = providerDoc?.service_locations || [];

    // Populate location_ids with name/area from auth_db
    let allLocationIds = [...new Set(services.flatMap(s => (s.location_ids || []).map((id: any) => String(id._id || id))))];
    if (allLocationIds.length === 0 && fallbackLocations.length > 0) {
      allLocationIds = [...new Set(fallbackLocations.map(String))];
    }

    let locationMap = new Map<string, any>();
    if (allLocationIds.length > 0) {
      try {
        const locations = await getLocationsBatch(allLocationIds);
        if (Array.isArray(locations)) {
          locationMap = new Map(locations.map((l: any) => [String(l._id), l]));
        }
      } catch (locErr) {
        console.warn('[PROVIDER-SERVICE] Failed to batch get locations:', locErr);
      }
    }

    const result = services.map(s => {
      const rawSubList = Array.isArray(s.subservice_ids) ? s.subservice_ids : [];
      const rawLocList = (Array.isArray(s.location_ids) && s.location_ids.length > 0) ? s.location_ids : fallbackLocations;

      return {
        ...s,
        subservice_ids: rawSubList.map(id => {
          const subStr = String(id._id || id);
          return subserviceMap.get(subStr) || { _id: subStr, subservice_name: '—' };
        }),
        location_ids: rawLocList.map((id: any) => {
          const locStr = String(id._id || id);
          const found = locationMap.get(locStr);
          if (found) {
            return {
              _id: found._id,
              name: found.name || found.area_name || found.location_name || found.city || 'Area',
              type: found.type || 'sub_area',
              pincode: found.pincode || '',
              city: found.city || (typeof found.parent_id === 'object' ? found.parent_id?.name : undefined)
            };
          }
          return typeof id === 'object' && id !== null ? id : { _id: locStr, name: 'Area', type: 'sub_area' };
        })
      };
    });

    res.json({ data: result, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error('[PROVIDER-SERVICE] getProviderServices error:', error);
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

// @desc    Update provider service location status / schedule / capacity (My Service Areas)
// @route   PUT /api/provider-services/locations/manage
// @access  Private/Provider/Admin
export const updateServiceLocationStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      provider_id,
      location_id,
      status,
      paused_reason,
      paused_until,
      schedules,
      capacity,
      correlation_id
    } = req.body;

    if (!provider_id || !location_id || !status) {
      res.status(400).json({ message: 'provider_id, location_id, and status are required.' });
      return;
    }

    const providerServices = await ProviderService.find({
      provider_id: new mongoose.Types.ObjectId(provider_id as string),
      isDeleted: false
    });

    if (providerServices.length === 0) {
      res.status(404).json({ message: 'No service records found for provider' });
      return;
    }

    const locObjId = new mongoose.Types.ObjectId(location_id as string);
    const updatedServices = [];

    for (const ps of providerServices) {
      let locSetting = ps.service_locations.find(sl => sl.location_id.toString() === locObjId.toString());
      const beforeState = locSetting ? JSON.parse(JSON.stringify(locSetting)) : {};

      let finalSetting: any;

      if (!locSetting) {
        finalSetting = {
          location_id: locObjId,
          status,
          paused_reason,
          paused_until: paused_until ? new Date(paused_until) : undefined,
          schedules: schedules || [],
          capacity,
          updated_by: req.user?.role === 'admin' ? 'admin' : 'provider',
          updated_at: new Date()
        };
        ps.service_locations.push(finalSetting as any);
      } else {
        locSetting.status = status;
        if (paused_reason !== undefined) locSetting.paused_reason = paused_reason;
        if (paused_until !== undefined) locSetting.paused_until = paused_until ? new Date(paused_until) : undefined;
        if (schedules !== undefined) locSetting.schedules = schedules;
        if (capacity !== undefined) locSetting.capacity = capacity;
        locSetting.updated_by = req.user?.role === 'admin' ? 'admin' : 'provider';
        locSetting.updated_at = new Date();
        finalSetting = locSetting;
      }

      // Maintain legacy location_ids array dual-write compatibility
      if (status === 'active' || status === 'paused') {
        const hasLegacy = ps.location_ids.some(id => id.toString() === locObjId.toString());
        if (!hasLegacy) ps.location_ids.push(locObjId);
      }

      await ps.save();
      updatedServices.push(ps);

      // Record immutable audit log
      await LocationAuditLog.create({
        correlation_id: correlation_id || `CORR-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        provider_id: ps.provider_id,
        location_id: locObjId,
        action: status === 'active' ? 'LOCATION_ENABLED' : (status === 'paused' ? 'LOCATION_PAUSED' : 'LOCATION_SUSPENDED'),
        changed_by: req.user?.role === 'admin' ? 'admin' : 'provider',
        reason: paused_reason || 'Provider toggle',
        before: beforeState,
        after: finalSetting || {},
        timestamp: new Date()
      }).catch(console.error);
    }

    res.json({ success: true, message: 'Service location updated successfully', updatedServices });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit location change request (Provider)
// @route   POST /api/provider-services/locations/request-change
// @access  Private/Provider
export const requestLocationChange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { current_location_id, current_location_name, requested_location_id, requested_location_name, reason } = req.body;

    if (!requested_location_id || !reason) {
      res.status(400).json({ message: 'Requested location and reason are required.' });
      return;
    }

    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found.' });
      return;
    }

    // Check if there is already a pending request
    const existingPending = await LocationChangeRequest.findOne({
      provider_id: provider._id,
      status: 'pending'
    });

    if (existingPending) {
      res.status(400).json({ message: 'You already have a relocation request pending admin approval.' });
      return;
    }

    const newRequest = await LocationChangeRequest.create({
      provider_id: provider._id,
      user_id: req.user?._id,
      current_location_id: current_location_id ? new mongoose.Types.ObjectId(current_location_id) : null,
      current_location_name: current_location_name || 'Current Location',
      requested_location_id: new mongoose.Types.ObjectId(requested_location_id),
      requested_location_name: requested_location_name || 'Requested Location',
      reason,
      status: 'pending'
    });

    res.status(201).json({ success: true, message: 'Relocation request submitted for admin review.', data: newRequest });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current provider's relocation request
// @route   GET /api/provider-services/locations/my-change-request
// @access  Private/Provider
export const getMyLocationChangeRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found.' });
      return;
    }

    const latestRequest = await LocationChangeRequest.findOne({ provider_id: provider._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: latestRequest });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all relocation requests (Admin)
// @route   GET /api/providers/admin/location-change-requests
// @access  Private/Admin
export const getAdminLocationChangeRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await LocationChangeRequest.find({})
      .populate('provider_id', 'user_id kyc_status availability_status')
      .sort({ createdAt: -1 })
      .lean();

    // Populate user names if possible
    const userIds = requests.map((r: any) => String(r.user_id)).filter(Boolean);
    const users = userIds.length > 0 ? await getUsersBatch(userIds) : [];
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));

    const enriched = requests.map((r: any) => ({
      ...r,
      provider_name: userMap.get(String(r.user_id))?.name || 'Provider',
      provider_phone: userMap.get(String(r.user_id))?.phone || '—'
    }));

    res.json({ success: true, data: enriched });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Review relocation request (Admin Approve/Reject)
// @route   PUT /api/providers/admin/location-change-requests/:id/review
// @access  Private/Admin
export const reviewLocationChangeRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, admin_comment } = req.body;

    if (!action || !['approved', 'rejected'].includes(action)) {
      res.status(400).json({ message: 'Valid action (approved or rejected) is required.' });
      return;
    }

    const request = await LocationChangeRequest.findById(id);
    if (!request) {
      res.status(404).json({ message: 'Relocation request not found.' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ message: `Request is already ${request.status}.` });
      return;
    }

    request.status = action;
    request.admin_comment = admin_comment || (action === 'approved' ? 'Approved by admin' : 'Rejected by admin');
    request.reviewed_by = req.user?.name || 'Admin';
    request.reviewed_at = new Date();
    await request.save();

    if (action === 'approved') {
      const provider = await Provider.findById(request.provider_id);
      if (provider) {
        // Add requested location to provider's service_locations array if not present
        const reqLocObjId = new mongoose.Types.ObjectId(request.requested_location_id);
        const hasLoc = provider.service_locations.some(id => id.toString() === reqLocObjId.toString());
        if (!hasLoc) {
          provider.service_locations.push(reqLocObjId);
          await provider.save();
        }

        // Also update ProviderServices records
        await ProviderService.updateMany(
          { provider_id: provider._id, isDeleted: false },
          { 
            $addToSet: { 
              location_ids: reqLocObjId,
              service_locations: {
                location_id: reqLocObjId,
                status: 'active',
                updated_by: 'admin',
                updated_at: new Date()
              }
            } 
          }
        );

        // Audit Log
        await LocationAuditLog.create({
          correlation_id: `RELOC-${Date.now()}`,
          provider_id: provider._id,
          location_id: reqLocObjId,
          action: 'RELOCATION_APPROVED',
          changed_by: 'admin',
          reason: `Relocation request approved: ${request.reason}`,
          before: { current_location: request.current_location_name },
          after: { requested_location: request.requested_location_name },
          timestamp: new Date()
        }).catch(console.error);
      }
    }

    res.json({ success: true, message: `Relocation request ${action} successfully.`, data: request });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
