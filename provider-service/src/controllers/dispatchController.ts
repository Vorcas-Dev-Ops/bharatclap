import { Request, Response } from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import { Provider } from '../models/Provider';
import { ProviderService } from '../models/ProviderService';
import { JobRequest } from '../models/JobRequest';
import { WalletTransaction } from '../models/WalletTransaction';
import { LeadFeeConfig } from '../models/LeadFeeConfig';
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

    // Support both address.location.coordinates (Address model) and address.coordinates.coordinates (legacy)
    const coords = address?.location?.coordinates || address?.coordinates?.coordinates;
    const hasRealCoords = Array.isArray(coords) && coords.length >= 2 && !(coords[0] === 0 && coords[1] === 0);

    const userLng = hasRealCoords ? coords[0] : 77.5946;
    const userLat = hasRealCoords ? coords[1] : 12.9716;
    const userPincode = address?.pincode;

    // ── Step 1: Find qualified provider IDs for this subservice ─────────────────
    const providerServices = await ProviderService.find({
      subservice_ids: booking.subservice_id,
      is_active: true,
      isDeleted: false
    }).select('provider_id location_ids').lean() as any[];

    if (providerServices.length === 0) {
      res.json({ message: 'No providers for this subservice', provider_id: null });
      return;
    }

    const qualifiedIds = providerServices.map((ps: any) => ps.provider_id);

    // Build a map of provider_id -> location_ids they serve
    const providerLocationMap = new Map<string, string[]>();
    for (const ps of providerServices) {
      const existing = providerLocationMap.get(String(ps.provider_id)) || [];
      providerLocationMap.set(String(ps.provider_id), [...existing, ...(ps.location_ids || []).map(String)]);
    }



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
              kitPurchased: true,
              $expr: {
                $gte: [
                  { $subtract: ["$walletBalance", "$reservedBalance"] },
                  50
                ]
              },
              isWalletBlocked: { $ne: true },
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
                kitPurchased: true,
                $expr: {
                  $gte: [
                    { $subtract: ["$walletBalance", "$reservedBalance"] },
                    50
                  ]
                },
                isWalletBlocked: { $ne: true },
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

    // ── TIER 3: Verified + location_ids match (GPS ignored) ───────────────────
    if (!bestProvider) {
      // Get the user's location_id from address if available
      const userLocationId = address?.location_id ? String(address.location_id) : null;

      const locationMatchedIds = qualifiedIds.filter((id: any) => {
        const locationIds = providerLocationMap.get(String(id)) || [];
        if (userLocationId && locationIds.includes(userLocationId)) return true;
        // Also match by pincode if location_id unavailable
        return false;
      });

      const searchIds = locationMatchedIds.length > 0 ? locationMatchedIds : qualifiedIds;

      const t3Matches = await Provider.find({
        _id: { $in: searchIds },
        kyc_status: 'verified',
        isDeleted: false,
        kitPurchased: true,
        $expr: {
          $gte: [
            { $subtract: ["$walletBalance", "$reservedBalance"] },
            50
          ]
        },
        isWalletBlocked: { $ne: true }
      }).limit(50).lean() as any[];

      if (t3Matches.length > 0) {
        const t3UserIds = t3Matches.map((c: any) => c.user_id.toString());
        const activeUsers = await getUsersBatch(t3UserIds);
        const activeSet = new Set(activeUsers.map((u: any) => u._id.toString()));
        const match = t3Matches.find((c: any) => activeSet.has(c.user_id.toString()));
        if (match) bestProvider = { ...match, distance: 0 };
      }
    }

    // ── TIER 4: Any verified provider for this subservice (last resort) ────────
    if (!bestProvider) {
      const t4Matches = await Provider.find({
        _id: { $in: qualifiedIds },
        kyc_status: 'verified',
        isDeleted: false,
        kitPurchased: true,
        $expr: {
          $gte: [
            { $subtract: ["$walletBalance", "$reservedBalance"] },
            50
          ]
        },
        isWalletBlocked: { $ne: true }
      }).limit(10).lean() as any[];

      if (t4Matches.length > 0) bestProvider = { ...t4Matches[0], distance: -1 };
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

      // Enforce Hold Reservation
      const feeConfig = await LeadFeeConfig.findOne({ subservice_id: booking.subservice_id });
      const leadFee = feeConfig ? feeConfig.lead_fee : 100;
      const providerDoc = await Provider.findById(bestProvider._id);
      if (providerDoc) {
        providerDoc.reservedBalance += leadFee;
        await providerDoc.save();

        await WalletTransaction.create({
          provider_id: providerDoc._id,
          type: 'hold',
          amount: leadFee,
          balanceAfter: providerDoc.walletBalance - providerDoc.reservedBalance,
          referenceId: String(booking._id),
          description: `Hold lead fee for booking dispatch #${booking.booking_id}`,
          status: 'success'
        });
      }
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

    // Support both address.location.coordinates (Address model) and address.coordinates.coordinates (legacy)
    const coords = address?.location?.coordinates || address?.coordinates?.coordinates;
    const hasRealCoords = Array.isArray(coords) && coords.length >= 2 && !(coords[0] === 0 && coords[1] === 0);

    const userLng = hasRealCoords ? coords[0] : 77.5946;
    const userLat = hasRealCoords ? coords[1] : 12.9716;
    const userPincode = address?.pincode;

    const subserviceIds = bookings.map(b => b.subservice_id);

    const providerServices = await ProviderService.find({
      subservice_ids: { $in: subserviceIds },
      is_active: true,
      isDeleted: false
    }).select('provider_id location_ids subservice_ids').lean() as any[];

    if (providerServices.length === 0) {
      res.json({ message: 'No providers found for these subservices', results: [] });
      return;
    }

    const allQualifiedIds = [...new Set(providerServices.map((ps: any) => String(ps.provider_id)))];

    // Build location_ids map per provider
    const providerLocationMap = new Map<string, string[]>();
    for (const ps of providerServices) {
      const existing = providerLocationMap.get(String(ps.provider_id)) || [];
      providerLocationMap.set(String(ps.provider_id), [...existing, ...(ps.location_ids || []).map(String)]);
    }



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
              kitPurchased: true,
              $expr: {
                $gte: [
                  { $subtract: ["$walletBalance", "$reservedBalance"] },
                  50
                ]
              },
              isWalletBlocked: { $ne: true },
              'live_location.coordinates.0': { $ne: 0 }
            }
          }
        }
      ]);
    } catch (e: any) {
      console.warn(`[DISPATCH BATCH] Geo error: ${e.message}`);
    }

    // Fallback pool: all verified providers for these subservices (no GPS requirement)
    const allProvidersFallback = await Provider.find({
      _id: { $in: allQualifiedIds.map(id => new mongoose.Types.ObjectId(id)) },
      kyc_status: 'verified',
      isDeleted: false,
      kitPurchased: true,
      $expr: {
        $gte: [
          { $subtract: ["$walletBalance", "$reservedBalance"] },
          50
        ]
      },
      isWalletBlocked: { $ne: true }
    }).limit(100).lean();

    // Pre-fetch ALL candidate user accounts in one batch call before the booking loop
    const allCandidates = [...nearbyProviders, ...allProvidersFallback];
    const allCandidateUserIds = [...new Set(allCandidates.map((p: any) => p.user_id.toString()))];
    const activeCandidateUsers = allCandidateUserIds.length > 0 ? await getUsersBatch(allCandidateUserIds) : [];
    const activeSet = new Set(activeCandidateUsers.map((u: any) => u._id.toString()));

    // Pre-fetch existing job requests to avoid N+1 queries
    const existingJobRequests = await JobRequest.find({
      booking_id: { $in: bookings.map(b => b._id) }
    }).lean();
    
    const existingJobReqMap = new Map();
    for (const jr of existingJobRequests as any[]) {
      existingJobReqMap.set(`${String(jr.booking_id)}_${String(jr.provider_id)}`, jr);
    }
    
    const jobRequestsToInsert: any[] = [];
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

      // Tier 3: location_ids match
      if (!bestProvider) {
        const userLocationId = address?.location_id ? String(address.location_id) : null;
        for (const p of allProvidersFallback) {
          if (!subserviceQualifiedIds.includes(String(p._id))) continue;
          const locationIds = providerLocationMap.get(String(p._id)) || [];
          if (userLocationId && locationIds.includes(userLocationId)) {
            bestProvider = { ...p, distance: 0 };
            break;
          }
        }
      }

      // Tier 4: any verified provider (last resort)
      if (!bestProvider) {
        for (const p of allProvidersFallback) {
          if (subserviceQualifiedIds.includes(String(p._id))) {
            bestProvider = { ...p, distance: -1 };
            break;
          }
        }
      }

      if (bestProvider) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        let jobRequest = existingJobReqMap.get(`${String(booking._id)}_${String(bestProvider._id)}`);
        
        if (!jobRequest) {
          jobRequest = {
            _id: new mongoose.Types.ObjectId(),
            booking_id: booking._id,
            provider_id: bestProvider._id,
            expires_at: expiresAt,
            distance: Math.round(bestProvider.distance || 0),
            status: 'pending'
          };
          jobRequestsToInsert.push(jobRequest);

          // Enforce Hold Reservation for Batch
          const feeConfig = await LeadFeeConfig.findOne({ subservice_id: booking.subservice_id });
          const leadFee = feeConfig ? feeConfig.lead_fee : 100;
          const providerDoc = await Provider.findById(bestProvider._id);
          if (providerDoc) {
            providerDoc.reservedBalance += leadFee;
            await providerDoc.save();

            await WalletTransaction.create({
              provider_id: providerDoc._id,
              type: 'hold',
              amount: leadFee,
              balanceAfter: providerDoc.walletBalance - providerDoc.reservedBalance,
              referenceId: String(booking._id),
              description: `Hold lead fee for booking batch dispatch #${booking.booking_id}`,
              status: 'success'
            });
          }
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

    if (jobRequestsToInsert.length > 0) {
      await JobRequest.insertMany(jobRequestsToInsert);
    }

    res.json({ message: 'Batch dispatched successfully', results });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
