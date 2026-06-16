import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Provider } from '../models/Provider';
import { ProviderService } from '../models/ProviderService';
import { JobRequest } from '../models/JobRequest';
import { emitToUser } from '../services/socketService';
import axios from 'axios';

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

      for (const c of tier1) {
        if (await isActiveUser(c.user_id)) {
          bestProvider = c;
          break;
        }
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

        for (const c of tier2) {
          if (await isActiveUser(c.user_id)) {
            bestProvider = c;
            break;
          }
        }
      } catch (e: any) {
        console.warn(`[DISPATCH] Tier 2 error: ${e.message}`);
      }
    }

    // ── TIER 3: Verified + Pincode or Area match (GPS ignored) ─────────────────
    if (!bestProvider) {
      const baseQuery = { _id: { $in: qualifiedIds }, kyc_status: 'verified', isDeleted: false };

      if (userPincode) {
        const allVerified = await Provider.find(baseQuery).lean() as any[];
        for (const c of allVerified) {
          const pincodes = providerPincodesMap.get(String(c._id)) || [];
          if (pincodes.includes(userPincode) && await isActiveUser(c.user_id)) {
            bestProvider = { ...c, distance: 0 };
            break;
          }
        }
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
