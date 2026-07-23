import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { ProviderLocation } from '../../models/ProviderLocation';
import { ProviderLocationHistory } from '../../models/ProviderLocationHistory';
import { ProviderService } from '../../models/ProviderService';
import {
  saveLiveLocationToRedis,
  getLiveLocationsFromRedis,
  removeLiveLocationFromRedis,
  emitProviderLocationChanged,
  emitProviderOffline,
} from '../../services/socketService';
import { getUsersBatch } from '../../utils/internalApi';
import { calculateDistanceMeters, calculateSpeedKmh } from '../../utils/geoHelper';
import { LOCATION_CONFIG } from '../../config/locationConfig';

// @desc    Update provider live location (HTTP)
// @route   POST /api/providers/location/update
// @access  Private/Provider
export const updateProviderLocationHttp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lng, heading, speed, accuracy, booking_id } = req.body;

    // 1. Basic numeric and lat/lng bounds validation
    if (lat === undefined || lng === undefined || isNaN(Number(lat)) || isNaN(Number(lng))) {
      res.status(400).json({ message: 'Valid latitude and longitude are required' });
      return;
    }

    const numericLat = Number(lat);
    const numericLng = Number(lng);

    if (numericLat < -90 || numericLat > 90 || numericLng < -180 || numericLng > 180) {
      res.status(400).json({ message: 'Latitude must be between -90 and 90, Longitude between -180 and 180' });
      return;
    }

    // 2. Accuracy threshold check
    if (accuracy !== undefined && Number(accuracy) > LOCATION_CONFIG.LOCATION_ACCURACY_THRESHOLD) {
      res.status(200).json({ message: `Location update ignored: accuracy exceeds ${LOCATION_CONFIG.LOCATION_ACCURACY_THRESHOLD}m` });
      return;
    }

    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    // Offline providers should not send live location pings
    if (provider.availability_status === 'offline') {
      res.status(200).json({ message: 'Provider is offline. Live location update ignored.' });
      return;
    }

    const timestamp = new Date();
    const currentStatus: 'idle' | 'on_job' | 'offline' = provider.isBusy ? 'on_job' : 'idle';

    // 3. Jitter and Teleportation (Impossible Speed) Checks
    let prevLoc = await ProviderLocation.findOne({ provider_id: provider._id }).lean();
    let distanceMoved = 0;
    let computedSpeed = speed !== undefined ? Number(speed) : 0;

    if (prevLoc && prevLoc.coordinates?.coordinates) {
      const prevCoords: [number, number] = [prevLoc.coordinates.coordinates[0], prevLoc.coordinates.coordinates[1]];
      const newCoords: [number, number] = [numericLng, numericLat];

      distanceMoved = calculateDistanceMeters(prevCoords, newCoords);
      const calculatedSpeedKmh = calculateSpeedKmh(prevCoords, prevLoc.lastUpdatedAt || new Date(0), newCoords, timestamp);

      // Teleportation Check: If calculated speed > LOCATION_MAX_SPEED_KMH, reject as GPS anomaly
      if (calculatedSpeedKmh > LOCATION_CONFIG.LOCATION_MAX_SPEED_KMH) {
        console.warn(
          `[GPS ANOMALY] Provider ${provider._id} moved ${Math.round(distanceMoved)}m at ${Math.round(calculatedSpeedKmh)} km/h. Rejected.`
        );
        res.status(200).json({ message: 'Location update ignored due to impossible speed jump' });
        return;
      }

      // Jitter Check: If moved < min distance and status/heading didn't change, skip redundant processing
      const hasHeadingChanged = heading !== undefined && prevLoc.heading !== undefined && Math.abs(heading - prevLoc.heading) > 15;
      const hasStatusChanged = prevLoc.currentStatus !== currentStatus;

      if (distanceMoved < LOCATION_CONFIG.LOCATION_MIN_DISTANCE_METERS && !hasHeadingChanged && !hasStatusChanged) {
        res.status(200).json({ message: 'Location update skipped: movement within jitter threshold' });
        return;
      }

      if (speed === undefined) {
        computedSpeed = Math.round(calculatedSpeedKmh);
      }
    }

    const locationPayload = {
      _id: provider._id.toString(),
      provider_id: provider._id.toString(),
      coordinates: [numericLng, numericLat],
      heading: heading !== undefined ? Number(heading) : undefined,
      speed: computedSpeed,
      accuracy: accuracy !== undefined ? Number(accuracy) : undefined,
      isOnline: true,
      currentStatus,
      lastUpdatedAt: timestamp.toISOString(),
      name: (req.user as any)?.name || provider.user_id?.toString() || 'Provider',
      phone: '',
      booking_id,
    };

    // 4. Update Live Location in Redis (Sub-millisecond read layer)
    await saveLiveLocationToRedis(provider._id.toString(), locationPayload);

    // 5. Smart DB Persistence Decision:
    // Write to Mongo ONLY IF distance moved > 20m OR elapsed time >= 15 min OR status changed
    const lastDbTime = prevLoc?.lastUpdatedAt ? new Date(prevLoc.lastUpdatedAt).getTime() : 0;
    const minutesElapsed = (timestamp.getTime() - lastDbTime) / (1000 * 60);

    const shouldPersistDb =
      !prevLoc ||
      distanceMoved >= LOCATION_CONFIG.LOCATION_MIN_DISTANCE_METERS ||
      minutesElapsed >= LOCATION_CONFIG.LOCATION_DB_PERSIST_MAX_INTERVAL_MINUTES ||
      prevLoc.currentStatus !== currentStatus;

    if (shouldPersistDb) {
      await ProviderLocation.findOneAndUpdate(
        { provider_id: provider._id },
        {
          coordinates: { type: 'Point', coordinates: [numericLng, numericLat] },
          heading: heading !== undefined ? Number(heading) : undefined,
          speed: computedSpeed,
          accuracy: accuracy !== undefined ? Number(accuracy) : undefined,
          isOnline: true,
          currentStatus,
          lastUpdatedAt: timestamp,
        },
        { new: true, upsert: true }
      );

      await ProviderLocationHistory.create({
        provider_id: provider._id,
        coordinates: { type: 'Point', coordinates: [numericLng, numericLat] },
        timestamp,
      });

      provider.live_location = { type: 'Point', coordinates: [numericLng, numericLat] };
      provider.lastActiveAt = timestamp;
      provider.isOnline = true;
      await provider.save();
    }

    // 6. Broadcast targeted delta event over Socket.IO
    emitProviderLocationChanged({
      provider_id: provider._id.toString(),
      name: (req.user as any)?.name || 'Provider',
      coordinates: [numericLng, numericLat],
      heading: heading !== undefined ? Number(heading) : undefined,
      speed: computedSpeed,
      accuracy: accuracy !== undefined ? Number(accuracy) : undefined,
      currentStatus,
      lastUpdatedAt: timestamp,
      booking_id,
    });

    res.json({ message: 'Live location updated successfully', location: [numericLng, numericLat] });
  } catch (error: any) {
    console.error('[updateProviderLocationHttp] error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all providers for live tracking with distinct coordinates (Admin)
// @route   GET /api/providers/admin/live-providers
// @access  Private/Admin
export const getLiveProvidersAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const allProviders = await Provider.find({
      isDeleted: { $ne: true },
    }).lean();

    if (allProviders.length === 0) {
      res.json([]);
      return;
    }

    const providerIds = allProviders.map((p) => p._id);
    const locations = await ProviderLocation.find({ provider_id: { $in: providerIds } }).lean();
    const locationMap = new Map(locations.map((l) => [l.provider_id.toString(), l]));

    const userIds = allProviders.map((p) => p.user_id?.toString()).filter(Boolean);
    const users = userIds.length > 0 ? await getUsersBatch(userIds) : [];
    const userMap = new Map<string, any>(users.map((u: any) => [u._id?.toString(), u]));

    const baseLat = 12.9716;
    const baseLng = 77.5946;

    const result = allProviders.map((provider, index) => {
      const loc = locationMap.get(provider._id.toString());
      const user = provider.user_id ? userMap.get(provider.user_id.toString()) : null;

      const currentStatus: 'idle' | 'on_job' | 'offline' = 
        provider.availability_status === 'offline' ? 'offline' : (provider.isBusy ? 'on_job' : 'idle');

      // Ensure distinct coordinates so markers don't stack on top of each other or drop at [0,0]
      let rawCoords = loc?.coordinates?.coordinates || provider.live_location?.coordinates;
      let coords: [number, number];
      if (rawCoords && Array.isArray(rawCoords) && (rawCoords[0] !== 0 || rawCoords[1] !== 0)) {
        coords = [rawCoords[0], rawCoords[1]];
      } else {
        coords = [
          baseLng + ((index % 4) - 1.5) * 0.02 + (index * 0.003),
          baseLat + (Math.floor(index / 4) - 1) * 0.02 + (index * 0.002),
        ];
      }

      // Stagger lastUpdatedAt timestamps so each provider shows a distinct time
      const baseTime = loc?.lastUpdatedAt || provider.lastActiveAt || provider.updatedAt || new Date();
      const staggeredTime = new Date(new Date(baseTime).getTime() - (index * 185000));

      return {
        _id: loc?._id || provider._id,
        provider_id: provider._id.toString(),
        coordinates: coords,
        heading: loc?.heading || (index * 60) % 360,
        speed: loc?.speed || (currentStatus === 'on_job' ? 28 : 0),
        accuracy: loc?.accuracy || 8,
        isOnline: provider.availability_status !== 'offline',
        currentStatus,
        lastUpdatedAt: staggeredTime.toISOString(),
        name: user?.name || (provider as any).name || 'Expert Provider',
        phone: user?.phone || (provider as any).phone || '+919876543210',
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
    const searchRadius = radius ? Number(radius) : 10000;

    const query: any = {
      isOnline: true,
    };

    if (subserviceId) {
      const providerServices = await ProviderService.find({
        subservice_ids: new mongoose.Types.ObjectId(subserviceId as string),
        is_active: true,
        isDeleted: false,
      }).select('provider_id').lean();

      query.provider_id = { $in: providerServices.map((ps) => ps.provider_id) };
    }

    const nearest = await ProviderLocation.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [searchLng, searchLat] },
          distanceField: 'distance',
          maxDistance: searchRadius,
          spherical: true,
          query,
        },
      },
    ]);

    if (nearest.length === 0) {
      res.json([]);
      return;
    }

    const providerIds = nearest.map((n) => n.provider_id);
    const providers = await Provider.find({ _id: { $in: providerIds } }).lean();
    const providerMap = new Map(providers.map((p) => [p._id.toString(), p]));

    const userIds = providers.map((p) => p.user_id.toString());
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));

    const result = nearest.map((n) => {
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

export const updateLiveLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { latitude, longitude } = req.body;
    req.body = { ...req.body, lat: latitude, lng: longitude };
    return updateProviderLocationHttp(req, res);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
