import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { ProviderLocation } from '../../models/ProviderLocation';
import { ProviderLocationHistory } from '../../models/ProviderLocationHistory';
import { ProviderService } from '../../models/ProviderService';
import { getIO } from '../../services/socketService';
import { getUsersBatch } from '../../utils/internalApi';

// @desc    Update provider live location (HTTP)
// @route   POST /api/providers/location/update
// @access  Private/Provider
export const updateProviderLocationHttp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lng, heading, speed, accuracy } = req.body;

    if (lat === undefined || lng === undefined) {
      res.status(400).json({ message: 'Latitude and Longitude are required' });
      return;
    }

    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    // Safeguard: Ignore accuracy > 100 meters
    if (accuracy !== undefined && accuracy > 100) {
      res.status(200).json({ message: 'Location update ignored due to low accuracy (> 100m)' });
      return;
    }

    const timestamp = new Date();

    // 1. Determine currentStatus: idle | on_job | offline
    const currentStatus = provider.isOnline
      ? (provider.isBusy ? 'on_job' : 'idle')
      : 'offline';

    // 2. Upsert into ProviderLocation
    const providerLocation = await ProviderLocation.findOneAndUpdate(
      { provider_id: provider._id },
      {
        coordinates: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
        heading: heading !== undefined ? Number(heading) : undefined,
        speed: speed !== undefined ? Number(speed) : undefined,
        accuracy: accuracy !== undefined ? Number(accuracy) : undefined,
        isOnline: true,
        currentStatus,
        lastUpdatedAt: timestamp,
      },
      { new: true, upsert: true }
    );

    // 3. Insert into ProviderLocationHistory
    await ProviderLocationHistory.create({
      provider_id: provider._id,
      coordinates: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
      timestamp,
    });

    // 4. Update core Provider document for backwards-compatibility
    provider.live_location = { type: 'Point', coordinates: [Number(lng), Number(lat)] };
    provider.lastActiveAt = timestamp;
    provider.isOnline = true;
    if (provider.availability_status === 'offline') {
      provider.availability_status = 'available';
    }
    await provider.save();

    // 5. Emit real-time Socket.IO update to admins/users monitoring provider locations
    try {
      const io = getIO();
      io.emit('provider_location_changed', {
        provider_id: provider._id,
        name: (provider as any)?.name || (req.user as any)?.name || 'Provider',
        coordinates: [Number(lng), Number(lat)],
        heading,
        speed,
        accuracy,
        currentStatus,
        lastUpdatedAt: timestamp,
      });
    } catch (socketErr: any) {
      // Fail silently if socket server is not fully initialized
    }

    res.json({ message: 'Live location updated successfully', location: providerLocation.coordinates });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all providers for live tracking (Admin)
// @route   GET /api/providers/admin/live-providers
// @access  Private/Admin
export const getLiveProvidersAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('[getLiveProvidersAdmin] Database not connected (readyState: %d), returning empty array', mongoose.connection.readyState);
      res.json([]);
      return;
    }

    const providers = await Provider.find({ isDeleted: { $ne: true } }).lean();
    if (providers.length === 0) {
      res.json([]);
      return;
    }

    const providerIds = providers.map(p => p._id);
    const locations = await ProviderLocation.find({ provider_id: { $in: providerIds } }).lean();
    const locationMap = new Map(locations.map(l => [l.provider_id.toString(), l]));

    const userIds = providers.map(p => p.user_id?.toString()).filter((id): id is string => Boolean(id));
    const users = userIds.length > 0 ? await getUsersBatch(userIds) : [];
    const userMap = new Map<string, any>(users.map((u: any) => [u._id?.toString(), u]));

    const result = providers.map(provider => {
      const loc = locationMap.get(provider._id.toString());
      const user = provider.user_id ? userMap.get(provider.user_id.toString()) : null;

      const isOnline = loc ? loc.isOnline : Boolean(provider.isOnline);
      let currentStatus: 'idle' | 'on_job' | 'offline' = 'offline';
      
      if (isOnline) {
        currentStatus = loc?.currentStatus === 'on_job' || provider.isBusy ? 'on_job' : 'idle';
      } else if (provider.availability_status === 'available') {
        currentStatus = 'idle';
      } else if (provider.availability_status === 'busy') {
        currentStatus = 'on_job';
      }

      const coords = loc?.coordinates?.coordinates || provider.live_location?.coordinates || [77.5946, 12.9716];

      return {
        _id: loc?._id || provider._id,
        provider_id: provider._id,
        coordinates: coords,
        heading: loc?.heading,
        speed: loc?.speed,
        accuracy: loc?.accuracy,
        isOnline: currentStatus !== 'offline',
        currentStatus,
        lastUpdatedAt: loc?.lastUpdatedAt || provider.updatedAt || provider.createdAt || new Date(),
        name: user?.name || (provider as any)?.business_name || 'Unknown Provider',
        phone: user?.phone || (provider as any)?.phone || '',
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('[getLiveProvidersAdmin] error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get nearest online providers sorted by distance (Admin)
// @route   GET /api/providers/admin/nearest-providers
// @access  Private/Admin
export const getNearestProvidersAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, radius, subserviceId } = req.query;

    if (!lat || !lng) {
      res.status(400).json({ message: 'lat and lng parameters are required' });
      return;
    }

    const searchLat = Number(lat);
    const searchLng = Number(lng);
    const searchRadius = radius ? Number(radius) : 10000; // default 10km

    const query: any = {
      isOnline: true,
    };

    if (subserviceId) {
      const providerServices = await ProviderService.find({
        subservice_ids: new mongoose.Types.ObjectId(subserviceId as string),
        is_active: true,
        isDeleted: false
      }).select('provider_id').lean();
      const qualifiedProviderIds = providerServices.map(ps => ps.provider_id);
      query.provider_id = { $in: qualifiedProviderIds };
    }

    const nearest = await ProviderLocation.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [searchLng, searchLat] },
          distanceField: 'distance',
          maxDistance: searchRadius,
          spherical: true,
          query: query
        }
      }
    ]);

    if (nearest.length === 0) {
      res.json([]);
      return;
    }

    const providerIds = nearest.map(n => n.provider_id);
    const providers = await Provider.find({ _id: { $in: providerIds } }).lean();
    const providerMap = new Map(providers.map(p => [p._id.toString(), p]));

    const userIds = providers.map(p => p.user_id.toString());
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));

    const result = nearest.map(n => {
      const provider: any = providerMap.get(n.provider_id.toString());
      const user: any = provider ? userMap.get(provider.user_id.toString()) : null;

      return {
        _id: n._id,
        provider_id: n.provider_id,
        coordinates: n.coordinates.coordinates,
        heading: n.heading,
        speed: n.speed,
        accuracy: n.accuracy,
        isOnline: n.isOnline,
        currentStatus: n.currentStatus,
        lastUpdatedAt: n.lastUpdatedAt,
        distance: n.distance,
        name: user?.name || 'Unknown Provider',
        phone: user?.phone || '',
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Keep updateLiveLocation (legacy PATCH route) for compatibility if any client calls it
export const updateLiveLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { latitude, longitude } = req.body;
    req.body = { lat: latitude, lng: longitude };
    return updateProviderLocationHttp(req, res);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
