import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { ProviderService } from '../../models/ProviderService';
import { getAddressesBatch } from '../../utils/internalApi';
import mongoose from 'mongoose';
import axios from 'axios';

let _locationsCache: any = null;
let _locationsCacheExpiry = 0;

// @desc    Update provider availability status
// @route   PUT /api/providers/availability
// @access  Private/Provider
export const updateMyAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    
    const update: any = { availability_status: status };
    if (status === 'offline') {
      update.isOnline = false;
      update.isBusy = false;
    } else if (status === 'available') {
      update.isOnline = true;
      update.isBusy = false;
    } else if (status === 'busy') {
      update.isOnline = true;
      update.isBusy = true;
    }

    const provider = await Provider.findOneAndUpdate(
      { user_id: req.user?._id },
      update,
      { new: true }
    );
    res.json({ message: 'Availability updated', status: provider?.availability_status, isOnline: provider?.isOnline });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check if any verified provider is available for a service at a given location
// @route   GET /api/providers/check-availability?subservice_id=X&location_id=Y&location_name=Z
// @access  Public
export const checkProviderAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subservice_id, location_id, location_name } = req.query as Record<string, string | undefined>;

    if (!subservice_id) {
      res.status(400).json({ available: false, message: 'subservice_id is required' });
      return;
    }

    // 1. Find ProviderService records offering this subservice
    const providerServices = await ProviderService.find({
      subservice_ids: new mongoose.Types.ObjectId(subservice_id),
      is_active: true,
      isDeleted: false
    }).select('provider_id').lean();

    const providerIds = providerServices.map((ps: any) => ps.provider_id);
    if (providerIds.length === 0) {
      res.json({ available: false });
      return;
    }

    // Base query: only verified, non-deleted providers
    const baseQuery: any = {
      _id: { $in: providerIds },
      is_verified: true,
      kyc_status: 'verified',
      isDeleted: false
    };

    // ── Location resolution ──────────────────────────────────────────────────
    const addresses = location_id && mongoose.Types.ObjectId.isValid(location_id) 
      ? await getAddressesBatch([location_id]) : [];
    
    let coordinates: [number, number] | null = null;
    let cityLocationId: mongoose.Types.ObjectId | null = null;
    let resolvedLocationText = location_name;

    if (location_id && location_id !== 'custom' && mongoose.Types.ObjectId.isValid(location_id)) {
      // Try as saved address first
      if (addresses.length > 0) {
        const address = addresses[0] as any;
        if (address.coordinates?.coordinates) coordinates = address.coordinates.coordinates;
        if (address.city) resolvedLocationText = address.city;
      } else {
        // Try as Location document (city / area / pincode)
        const locs = await axios.post(`${process.env.AUTH_SERVICE_URL || 'http://localhost:5001'}/api/locations/batch`, { ids: [location_id] }, {
          headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
        }).catch(() => ({ data: [] }));
        if (locs.data && locs.data.length > 0) {
          const loc = locs.data[0];
          cityLocationId = loc._id;
          resolvedLocationText = loc.name;
          if (loc.coordinates?.coordinates) coordinates = loc.coordinates.coordinates;
        }
      }
    }

    if (!_locationsCache || Date.now() > _locationsCacheExpiry) {
      const allLocs = await axios.get(`${process.env.AUTH_SERVICE_URL || 'http://localhost:5001'}/api/locations`).catch(() => ({ data: [] }));
      _locationsCache = allLocs.data;
      _locationsCacheExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    }
    const locationsList = _locationsCache;

    // Match by name if we still don't have a cityLocationId
    if (!cityLocationId && resolvedLocationText && Array.isArray(locationsList)) {
      const loc = locationsList.find((l: any) => 
        l.name.toLowerCase() === resolvedLocationText!.toLowerCase() && l.status === 'active'
      );
      if (loc) cityLocationId = loc._id;
    }

    // ── Candidate lookup ─────────────────────────────────────────────────────
    // 2a. Geo-proximity check (within 30 km)
    if (coordinates) {
      const geoCandidates = await Provider.find({
        ...baseQuery,
        live_location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates },
            $maxDistance: 30000
          }
        }
      }).lean();
      if (geoCandidates.length > 0) {
        res.json({ available: true });
        return;
      }
    }

    // 2b. service_locations match (city ID stored on provider)
    if (cityLocationId) {
      const locCandidates = await Provider.find({
        ...baseQuery,
        service_locations: cityLocationId
      }).lean();
      if (locCandidates.length > 0) {
        res.json({ available: true });
        return;
      }
    }

    // 2c. Pincode / area fallback – look up child location IDs under the resolved city
    if (location_id && mongoose.Types.ObjectId.isValid(location_id) && Array.isArray(locationsList)) {
      const childLocs = locationsList.filter((l: any) => String(l.parent_id) === String(location_id) && l.status === 'active');
      const childIds = childLocs.map((l: any) => l._id);
      if (childIds.length > 0) {
        const areaCandidates = await Provider.find({
          ...baseQuery,
          service_locations: { $in: childIds }
        }).lean();
        if (areaCandidates.length > 0) {
          res.json({ available: true });
          return;
        }
      }
    }

    res.json({ available: false });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
