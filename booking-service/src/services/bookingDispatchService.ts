import mongoose, { Schema } from 'mongoose';
import { Booking } from '../models/Booking';
import http from 'http';

// ── Lazy DB connections ────────────────────────────────────────────────────────
let authConnection: mongoose.Connection | null = null;
let providerConnection: mongoose.Connection | null = null;

let AddressModel: any = null;
let UserModel: any = null;
let LocationModel: any = null;
let ProviderModel: any = null;
let ProviderServiceModel: any = null;
let JobRequestModel: any = null;

const getAuthConnection = () => {
  if (!authConnection) {
    authConnection = mongoose.createConnection(
      process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db'
    );
  }
  return authConnection;
};

const getProviderConnection = () => {
  if (!providerConnection) {
    providerConnection = mongoose.createConnection(
      process.env.PROVIDER_DB_URI || 'mongodb://localhost:27017/provider_db'
    );
  }
  return providerConnection;
};

const getAddressModel = () => {
  if (!AddressModel) AddressModel = getAuthConnection().model('Address', new Schema({}, { strict: false }), 'addresses');
  return AddressModel;
};
const getUserModel = () => {
  if (!UserModel) UserModel = getAuthConnection().model('User', new Schema({}, { strict: false }), 'users');
  return UserModel;
};
const getLocationModel = () => {
  if (!LocationModel) LocationModel = getAuthConnection().model('Location', new Schema({}, { strict: false }), 'locations');
  return LocationModel;
};
const getProviderModel = () => {
  if (!ProviderModel) ProviderModel = getProviderConnection().model('Provider', new Schema({}, { strict: false }), 'providers');
  return ProviderModel;
};
const getProviderServiceModel = () => {
  if (!ProviderServiceModel) ProviderServiceModel = getProviderConnection().model('ProviderService', new Schema({}, { strict: false }), 'providerservices');
  return ProviderServiceModel;
};
const getJobRequestModel = () => {
  if (!JobRequestModel) {
    const schema = new Schema({
      booking_id:  { type: Schema.Types.ObjectId, required: true },
      provider_id: { type: Schema.Types.ObjectId, required: true },
      expires_at:  { type: Date, required: true },
      distance:    { type: Number },
      status:      { type: String, default: 'pending' }
    }, { timestamps: true });
    JobRequestModel = getProviderConnection().model('JobRequest', schema, 'jobrequests');
  }
  return JobRequestModel;
};

// ── Internal socket emitter (HTTP → provider-service) ─────────────────────────
const emitToProviderServiceSocket = (userId: string, event: string, data: any) => {
  const payload = JSON.stringify({ userId, event, data });
  const options = {
    hostname: 'localhost',
    port: 5003,
    path: '/api/providers/socket-emit',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  };
  const req = http.request(options, (res) => { res.on('data', () => {}); });
  req.on('error', (err) => console.error(`[DISPATCH] Socket emit failed: ${err.message}`));
  req.write(payload);
  req.end();
};

// ── Main Dispatcher ────────────────────────────────────────────────────────────
/**
 * Monolithic-style Uber/UrbanCompany dispatch:
 * Uses MongoDB $geoNear aggregation with a 3-tier fallback to auto-assign
 * the single best (closest) provider to a booking.
 *
 * Tier 1 — Online + Verified + Not Busy + within 30km GPS
 * Tier 2 — Verified (offline OK) + within 30km GPS
 * Tier 3 — Verified + Pincode match OR service_locations area match (GPS ignored)
 */
export const dispatchNearbyProviders = async (bookingId: string) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    // Mark booking as actively searching
    await Booking.findByIdAndUpdate(bookingId, { status: 'provider_searching' });

    // ── Resolve user address & coordinates ──────────────────────────────────────
    const AModel = getAddressModel();
    const address = await AModel.findById(booking.address_id).lean() as any;

    const coords = address?.coordinates?.coordinates;
    const hasRealCoords = Array.isArray(coords) && coords.length >= 2 &&
                          !(coords[0] === 0 && coords[1] === 0);

    // Fallback to Bangalore city center if address has no GPS coordinates
    const userLng = hasRealCoords ? coords[0] : 77.5946;
    const userLat = hasRealCoords ? coords[1] : 12.9716;
    const userPincode: string | undefined = address?.pincode;

    console.log(`[DISPATCH] Booking ${booking.booking_id} | pincode: ${userPincode} | [${userLng}, ${userLat}]${hasRealCoords ? '' : ' (fallback coords)'}`);

    // ── Step 1: Find qualified provider IDs for this subservice ─────────────────
    const PSModel = getProviderServiceModel();
    const providerServices = await PSModel.find({
      subservice_ids: booking.subservice_id,
      is_active: true,
      isDeleted: false
    }).select('provider_id service_pincodes').lean() as any[];

    if (providerServices.length === 0) {
      console.log(`[DISPATCH] ❌ No ProviderService records for subservice ${booking.subservice_id}`);
      return;
    }

    const qualifiedIds = providerServices.map((ps: any) => ps.provider_id);

    // Build provider_id → service_pincodes map for Tier 3 pincode matching
    const providerPincodesMap = new Map<string, string[]>();
    for (const ps of providerServices) {
      const existing = providerPincodesMap.get(String(ps.provider_id)) || [];
      providerPincodesMap.set(String(ps.provider_id), [...existing, ...(ps.service_pincodes || [])]);
    }

    console.log(`[DISPATCH] ${qualifiedIds.length} provider(s) offer the requested subservice`);

    const PModel = getProviderModel();
    const UModel = getUserModel();
    const LModel = getLocationModel();

    // Helper: check if the provider's user account is active
    const isActiveUser = async (userId: any): Promise<boolean> =>
      !!(await UModel.findOne({ _id: userId, status: 'active', isDeleted: false }).lean());

    let bestProvider: any = null;

    // ── TIER 1: Online + Verified + Not Busy + GPS within 30km ─────────────────
    try {
      const tier1 = await PModel.aggregate([
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
          console.log(`[DISPATCH] ✅ Tier 1 (online+verified): provider ${c._id} at ${(c.distance / 1000).toFixed(1)}km`);
          break;
        }
      }
    } catch (e: any) {
      console.warn(`[DISPATCH] Tier 1 $geoNear error: ${e.message}`);
    }

    // ── TIER 2: Verified (offline OK) + GPS within 30km ────────────────────────
    if (!bestProvider) {
      console.log(`[DISPATCH] Tier 1 empty → Tier 2 (offline verified providers)`);
      try {
        const tier2 = await PModel.aggregate([
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
            console.log(`[DISPATCH] ✅ Tier 2 (offline verified): provider ${c._id} at ${(c.distance / 1000).toFixed(1)}km`);
            break;
          }
        }
      } catch (e: any) {
        console.warn(`[DISPATCH] Tier 2 $geoNear error: ${e.message}`);
      }
    }

    // ── TIER 3: Verified + Pincode or Area match (GPS ignored) ─────────────────
    if (!bestProvider) {
      console.log(`[DISPATCH] Tier 2 empty → Tier 3 (area/pincode match, GPS ignored)`);

      const baseQuery = { _id: { $in: qualifiedIds }, kyc_status: 'verified', isDeleted: false };

      // 3a — Direct pincode match via ProviderService.service_pincodes
      if (userPincode) {
        const allVerified = await PModel.find(baseQuery).lean() as any[];
        for (const c of allVerified) {
          const pincodes = providerPincodesMap.get(String(c._id)) || [];
          if (pincodes.includes(userPincode) && await isActiveUser(c.user_id)) {
            bestProvider = { ...c, distance: 0 };
            console.log(`[DISPATCH] ✅ Tier 3a (service_pincodes match): provider ${c._id}`);
            break;
          }
        }
      }

      // 3b — service_locations area match using nearby Location IDs
      if (!bestProvider) {
        let nearbyLocIds: any[] = [];
        try {
          const nearbyLocs = await LModel.aggregate([
            {
              $geoNear: {
                near: { type: 'Point', coordinates: [userLng, userLat] },
                distanceField: 'distance',
                maxDistance: 15000,
                spherical: true,
                query: { status: 'active', isDeleted: false }
              }
            }
          ]);
          nearbyLocIds = nearbyLocs.map((l: any) => l._id);
        } catch {
          // If Location collection has no 2dsphere index, fetch all active locations
          nearbyLocIds = (await LModel.find({ status: 'active', isDeleted: false }).select('_id').lean())
            .map((l: any) => l._id);
        }

        if (nearbyLocIds.length > 0) {
          const byArea = await PModel.find({
            ...baseQuery,
            service_locations: { $in: nearbyLocIds }
          }).lean() as any[];

          for (const c of byArea) {
            if (await isActiveUser(c.user_id)) {
              bestProvider = { ...c, distance: 0 };
              console.log(`[DISPATCH] ✅ Tier 3b (service_locations area match): provider ${c._id}`);
              break;
            }
          }
        }
      }
    }

    if (!bestProvider) {
      console.log(`[DISPATCH] ❌ No provider found across all 3 tiers for booking ${booking.booking_id}`);
      return;
    }

    // ── Auto-assign best provider; booking stays 'pending' (awaiting confirmation) ──
    await Booking.findByIdAndUpdate(bookingId, { provider_id: bestProvider._id });
    console.log(`[DISPATCH] Provider ${bestProvider._id} auto-assigned to booking ${booking.booking_id}`);

    // ── Create ONE JobRequest for the assigned provider ─────────────────────────
    const JRModel = getJobRequestModel();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10-minute window

    let jobRequest = await JRModel.findOne({ booking_id: booking._id, provider_id: bestProvider._id });
    if (!jobRequest) {
      jobRequest = await JRModel.create({
        booking_id: booking._id,
        provider_id: bestProvider._id,
        expires_at: expiresAt,
        distance: Math.round(bestProvider.distance || 0),
        status: 'pending'
      });
    }

    // ── Emit booking_assigned → Provider ───────────────────────────────────────
    emitToProviderServiceSocket(String(bestProvider.user_id), 'booking_assigned', {
      request_id: jobRequest._id,
      booking_id: booking._id,
      display_id: booking.booking_id,
      service_name: booking.variant_name || 'New Service Request',
      amount: booking.payable_amount,
      location: {
        address:  address?.address_line || '',
        city:     address?.city || '',
        pincode:  address?.pincode || '',
        distance: bestProvider.distance
          ? (bestProvider.distance / 1000).toFixed(1) + ' km'
          : 'Nearby'
      },
      scheduled_at:  booking.scheduled_at,
      booking_time:  booking.booking_time,
      expires_at:    expiresAt
    });

    // ── Emit booking_status_update → Customer ──────────────────────────────────
    emitToProviderServiceSocket(String(booking.user_id), 'booking_status_update', {
      booking_id: booking._id,
      status:     'provider_searching',
      message:    'A provider has been found! Waiting for their confirmation.'
    });

    console.log(`[DISPATCH] ✅ JobRequest ${jobRequest._id} created — awaiting provider confirmation`);

  } catch (error) {
    console.error('[DISPATCH] Pipeline error:', error);
  }
};

export const dispatchBooking = dispatchNearbyProviders;
