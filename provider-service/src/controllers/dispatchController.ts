import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Provider } from '../models/Provider';
import { ProviderService } from '../models/ProviderService';
import { JobRequest } from '../models/JobRequest';
import { emitToUser } from '../services/socketService';
import { getUsersBatch } from '../utils/internalApi';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';

// @desc    Internal API to dispatch booking to nearby providers
// @route   POST /api/providers/internal/dispatch
// @access  Internal
export const dispatchToProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking, address } = req.body;

    if (!booking || !address) {
      res.status(400).json({ message: 'Booking and address required' });
      return;
    }

    const coords = address?.coordinates?.coordinates;
    const hasRealCoords = Array.isArray(coords) && coords.length >= 2 && !(coords[0] === 0 && coords[1] === 0);

    const userLng = hasRealCoords ? coords[0] : 77.5946;
    const userLat = hasRealCoords ? coords[1] : 12.9716;
    const userPincode = address?.pincode;

    // ── Step 1: Find qualified provider IDs for this subservice ─────────────────
    const providerServices = await ProviderService.find({
      subservice_ids: booking.subservice_id,
      is_active: true,
      isDeleted: false
    }).select('provider_id service_pincodes').lean() as any[];

    if (providerServices.length === 0) {
      res.json({ message: 'No providers for this subservice', provider_id: null });
      return;
    }

    const qualifiedIds = providerServices.map((ps: any) => ps.provider_id);

    const providerPincodesMap = new Map<string, string[]>();
    for (const ps of providerServices) {
      const existing = providerPincodesMap.get(String(ps.provider_id)) || [];
      providerPincodesMap.set(String(ps.provider_id), [...existing, ...(ps.service_pincodes || [])]);
    }

    // Helper: check if the provider's user account is active via auth-service batch
    // To minimize calls, we could fetch all qualified users, but let's just do it directly.
    const isActiveUser = async (userId: any): Promise<boolean> => {
      try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/api/users/batch`, { ids: [userId.toString()] });
        // Since we only return active/undeleted users in batch usually, if it exists it's active.
        // Or we just assume true if it returns anything.
        return response.data && response.data.length > 0;
      } catch (err) {
        return false;
      }
    };

    let bestProvider: any = null;

    // ── TIER 1: Online + Verified + Not Busy + GPS within 30km ─────────────────
    try {
      const tier1 = await Provider.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [userLng, userLat] },
            distanceField: 'distance',
            maxDistance: 30000,
            spherical: true,
            query: {
              _id: { $in: qualifiedIds },
              kyc_status: 'verified',
              isOnline: true,
              isBusy: { $ne: true },
              isDeleted: false,
              'live_location.coordinates.0': { $ne: 0 }
            }
          }
        },
        { $limit: 15 }
      ]);

      // Batch-fetch all candidate user accounts in ONE call, then do O(1) Set lookup
      if (tier1.length > 0) {
        const t1UserIds = tier1.map((c: any) => c.user_id.toString());
        const activeUsers = await getUsersBatch(t1UserIds);
        const activeSet = new Set(activeUsers.map((u: any) => u._id.toString()));
        bestProvider = tier1.find((c: any) => activeSet.has(c.user_id.toString())) ?? null;
      }
    } catch (e: any) {
      console.warn(`[DISPATCH] Tier 1 error: ${e.message}`);
    }

    // ── TIER 2: Verified (offline OK) + GPS within 30km ────────────────────────
    if (!bestProvider) {
      try {
        const tier2 = await Provider.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [userLng, userLat] },
              distanceField: 'distance',
              maxDistance: 30000,
              spherical: true,
              query: {
                _id: { $in: qualifiedIds },
                kyc_status: 'verified',
                isDeleted: false,
                'live_location.coordinates.0': { $ne: 0 }
              }
            }
          },
          { $limit: 15 }
        ]);

        if (tier2.length > 0) {
          const t2UserIds = tier2.map((c: any) => c.user_id.toString());
          const activeUsers = await getUsersBatch(t2UserIds);
          const activeSet = new Set(activeUsers.map((u: any) => u._id.toString()));
          bestProvider = tier2.find((c: any) => activeSet.has(c.user_id.toString())) ?? null;
        }
      } catch (e: any) {
        console.warn(`[DISPATCH] Tier 2 error: ${e.message}`);
      }
    }

    // ── TIER 3: Verified + Pincode or Area match (GPS ignored) ─────────────────
    if (!bestProvider && userPincode) {
      const baseQuery = { _id: { $in: qualifiedIds }, kyc_status: 'verified', isDeleted: false };
      const allVerified = await Provider.find(baseQuery).lean() as any[];

      // Filter by pincode first (pure in-memory), then batch-check active status once
      const pincodeMatches = allVerified.filter(c => {
        const pincodes = providerPincodesMap.get(String(c._id)) || [];
        return pincodes.includes(userPincode);
      });

      if (pincodeMatches.length > 0) {
        const t3UserIds = pincodeMatches.map((c: any) => c.user_id.toString());
        const activeUsers = await getUsersBatch(t3UserIds);
        const activeSet = new Set(activeUsers.map((u: any) => u._id.toString()));
        const match = pincodeMatches.find((c: any) => activeSet.has(c.user_id.toString()));
        if (match) bestProvider = { ...match, distance: 0 };
      }
    }

    if (!bestProvider) {
      res.json({ message: 'No provider found', provider_id: null });
      return;
    }

    // Create JobRequest
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10-minute window
    let jobRequest = await JobRequest.findOne({ booking_id: booking._id, provider_id: bestProvider._id });
    
    if (!jobRequest) {
      jobRequest = await JobRequest.create({
        booking_id: booking._id,
        provider_id: bestProvider._id,
        expires_at: expiresAt,
        distance: Math.round(bestProvider.distance || 0),
        status: 'pending'
      });
    }

    // Emit Socket Events
    emitToUser(String(bestProvider.user_id), 'booking_assigned', {
      request_id: jobRequest._id,
      booking_id: booking._id,
      display_id: booking.booking_id,
      service_name: booking.variant_name || 'New Service Request',
      amount: booking.payable_amount,
      location: {
        address: address?.address_line || '',
        city: address?.city || '',
        pincode: address?.pincode || '',
        distance: bestProvider.distance ? (bestProvider.distance / 1000).toFixed(1) + ' km' : 'Nearby'
      },
      scheduled_at: booking.scheduled_at,
      booking_time: booking.booking_time,
      expires_at: expiresAt
    });

    emitToUser(String(booking.user_id), 'booking_status_update', {
      booking_id: booking._id,
      status: 'provider_searching',
      message: 'A provider has been found! Waiting for their confirmation.'
    });

    res.json({ message: 'Dispatched successfully', provider_id: bestProvider._id });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Internal API to dispatch multiple bookings to nearby providers
// @route   POST /api/providers/internal/dispatch-batch
// @access  Internal
export const dispatchBatchToProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookings, address } = req.body;

    if (!bookings || !Array.isArray(bookings) || bookings.length === 0 || !address) {
      res.status(400).json({ message: 'Bookings array and address required' });
      return;
    }

    const coords = address?.coordinates?.coordinates;
    const hasRealCoords = Array.isArray(coords) && coords.length >= 2 && !(coords[0] === 0 && coords[1] === 0);

    const userLng = hasRealCoords ? coords[0] : 77.5946;
    const userLat = hasRealCoords ? coords[1] : 12.9716;
    const userPincode = address?.pincode;

    const subserviceIds = bookings.map(b => b.subservice_id);

    const providerServices = await ProviderService.find({
      subservice_ids: { $in: subserviceIds },
      is_active: true,
      isDeleted: false
    }).select('provider_id service_pincodes subservice_ids').lean() as any[];

    if (providerServices.length === 0) {
      res.json({ message: 'No providers found for these subservices', results: [] });
      return;
    }

    const allQualifiedIds = [...new Set(providerServices.map((ps: any) => String(ps.provider_id)))];

    const providerPincodesMap = new Map<string, string[]>();
    for (const ps of providerServices) {
      const existing = providerPincodesMap.get(String(ps.provider_id)) || [];
      providerPincodesMap.set(String(ps.provider_id), [...existing, ...(ps.service_pincodes || [])]);
    }

    const isActiveUser = async (userId: any): Promise<boolean> => {
      try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/api/users/batch`, { ids: [userId.toString()] });
        return response.data && response.data.length > 0;
      } catch (err) {
        return false;
      }
    };

    let nearbyProviders: any[] = [];
    try {
      nearbyProviders = await Provider.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [userLng, userLat] },
            distanceField: 'distance',
            maxDistance: 30000,
            spherical: true,
            query: {
              _id: { $in: allQualifiedIds.map(id => new mongoose.Types.ObjectId(id)) },
              kyc_status: 'verified',
              isDeleted: false,
              'live_location.coordinates.0': { $ne: 0 }
            }
          }
        }
      ]);
    } catch (e: any) {
      console.warn(`[DISPATCH BATCH] Geo error: ${e.message}`);
    }

    let allProvidersFallback: any[] = [];
    if (userPincode) {
       allProvidersFallback = await Provider.find({
         _id: { $in: allQualifiedIds.map(id => new mongoose.Types.ObjectId(id)) },
         kyc_status: 'verified',
         isDeleted: false
       }).limit(100).lean();
    }

    // Pre-fetch ALL candidate user accounts in one batch call before the booking loop
    const allCandidates = [...nearbyProviders, ...allProvidersFallback];
    const allCandidateUserIds = [...new Set(allCandidates.map((p: any) => p.user_id.toString()))];
    const activeCandidateUsers = allCandidateUserIds.length > 0 ? await getUsersBatch(allCandidateUserIds) : [];
    const activeSet = new Set(activeCandidateUsers.map((u: any) => u._id.toString()));

    const results = [];

    for (const booking of bookings) {
      const subserviceQualifiedIds = providerServices
        .filter(ps => ps.subservice_ids.map(String).includes(String(booking.subservice_id)))
        .map(ps => String(ps.provider_id));

      let bestProvider: any = null;

      // All lookups below are pure in-memory — zero I/O inside this loop
      for (const p of nearbyProviders) {
        if (subserviceQualifiedIds.includes(String(p._id)) && p.isOnline && !p.isBusy && activeSet.has(p.user_id.toString())) {
          bestProvider = p;
          break;
        }
      }

      if (!bestProvider) {
        for (const p of nearbyProviders) {
          if (subserviceQualifiedIds.includes(String(p._id)) && activeSet.has(p.user_id.toString())) {
            bestProvider = p;
            break;
          }
        }
      }

      if (!bestProvider && userPincode) {
        for (const p of allProvidersFallback) {
          if (subserviceQualifiedIds.includes(String(p._id)) && activeSet.has(p.user_id.toString())) {
            const pincodes = providerPincodesMap.get(String(p._id)) || [];
            if (pincodes.includes(userPincode)) {
              bestProvider = { ...p, distance: 0 };
              break;
            }
          }
        }
      }

      if (bestProvider) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        let jobRequest = await JobRequest.findOne({ booking_id: booking._id, provider_id: bestProvider._id });
        
        if (!jobRequest) {
          jobRequest = await JobRequest.create({
            booking_id: booking._id,
            provider_id: bestProvider._id,
            expires_at: expiresAt,
            distance: Math.round(bestProvider.distance || 0),
            status: 'pending'
          });
        }

        emitToUser(String(bestProvider.user_id), 'booking_assigned', {
          request_id: jobRequest._id,
          booking_id: booking._id,
          display_id: booking.booking_id,
          service_name: booking.variant_name || 'New Service Request',
          amount: booking.payable_amount,
          location: {
            address: address?.address_line || '',
            city: address?.city || '',
            pincode: address?.pincode || '',
            distance: bestProvider.distance ? (bestProvider.distance / 1000).toFixed(1) + ' km' : 'Nearby'
          },
          scheduled_at: booking.scheduled_at,
          booking_time: booking.booking_time,
          expires_at: expiresAt
        });

        emitToUser(String(booking.user_id), 'booking_status_update', {
          booking_id: booking._id,
          status: 'provider_searching',
          message: 'A provider has been found! Waiting for their confirmation.'
        });

        results.push({ booking_id: booking._id, provider_id: bestProvider._id });
      } else {
        results.push({ booking_id: booking._id, provider_id: null });
      }
    }

    res.json({ message: 'Batch dispatched successfully', results });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
