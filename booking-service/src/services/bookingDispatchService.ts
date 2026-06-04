import mongoose, { Schema } from 'mongoose';
import { Booking } from '../models/Booking';
import http from 'http';

// Decoupled Connections
/**
 * Haversine Formula to calculate distance between coordinates (in meters)
 */
const getHaversineDistance = (lon1: number, lat1: number, lon2: number, lat2: number): number => {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

let authConnection: mongoose.Connection | null = null;
let providerConnection: mongoose.Connection | null = null;
let paymentConnection: mongoose.Connection | null = null;
let catalogConnection: mongoose.Connection | null = null;

const getPaymentDb = () => {
  if (!paymentConnection) {
    const paymentDbURI = process.env.PAYMENT_DB_URI || 'mongodb://localhost:27017/payment_db';
    paymentConnection = mongoose.createConnection(paymentDbURI);
  }
  return paymentConnection;
};

const getCatalogDb = () => {
  if (!catalogConnection) {
    const catalogDbURI = process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db';
    catalogConnection = mongoose.createConnection(catalogDbURI);
  }
  return catalogConnection;
};

let AddressModel: any = null;
let ProviderModel: any = null;
let ProviderServiceModel: any = null;
let JobRequestModel: any = null;

const getAddressModel = () => {
  if (!AddressModel) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    authConnection = mongoose.createConnection(authDbURI);
    const addressSchema = new Schema({}, { strict: false });
    AddressModel = authConnection.model('Address', addressSchema, 'addresses');
  }
  return AddressModel;
};

const getProviderConnection = () => {
  if (!providerConnection) {
    const providerDbURI = process.env.PROVIDER_DB_URI || 'mongodb://localhost:27017/provider_db';
    providerConnection = mongoose.createConnection(providerDbURI);
  }
  return providerConnection;
};

const getProviderModel = () => {
  if (!ProviderModel) {
    const conn = getProviderConnection();
    const providerSchema = new Schema({}, { strict: false });
    ProviderModel = conn.model('Provider', providerSchema, 'providers');
  }
  return ProviderModel;
};

const getProviderServiceModel = () => {
  if (!ProviderServiceModel) {
    const conn = getProviderConnection();
    const psSchema = new Schema({}, { strict: false });
    ProviderServiceModel = conn.model('ProviderService', psSchema, 'providerservices');
  }
  return ProviderServiceModel;
};

const getJobRequestModel = () => {
  if (!JobRequestModel) {
    const conn = getProviderConnection();
    const jrSchema = new Schema({
      booking_id: { type: Schema.Types.ObjectId, required: true },
      provider_id: { type: Schema.Types.ObjectId, required: true },
      expires_at: { type: Date, required: true },
      distance: { type: Number },
      status: { type: String, default: 'pending' }
    }, { timestamps: true });
    JobRequestModel = conn.model('JobRequest', jrSchema, 'jobrequests');
  }
  return JobRequestModel;
};

// Internal HTTP out-of-process emitter
const emitToProviderServiceSocket = (userId: string, event: string, data: any) => {
  const payload = JSON.stringify({ userId, event, data });
  const options = {
    hostname: 'localhost',
    port: 5003,
    path: '/api/providers/socket-emit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    res.on('data', () => {});
  });
  
  req.on('error', (err) => {
    console.error(`[DISPATCH] Socket trigger connection failed: ${err.message}`);
  });
  
  req.write(payload);
  req.end();
};

let UserModel: any = null;
let LocationModel: any = null;

const getUserModel = () => {
  if (!UserModel) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    if (!authConnection) authConnection = mongoose.createConnection(authDbURI);
    const userSchema = new Schema({}, { strict: false });
    UserModel = authConnection.model('User', userSchema, 'users');
  }
  return UserModel;
};

const getLocationModel = () => {
  if (!LocationModel) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    if (!authConnection) authConnection = mongoose.createConnection(authDbURI);
    const locSchema = new Schema({}, { strict: false });
    LocationModel = authConnection.model('Location', locSchema, 'locations');
  }
  return LocationModel;
};

/**
 * Advanced Dispatcher implementing strict Service Matching Flow
 */
export const dispatchNearbyProviders = async (bookingId: string) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    const AModel = getAddressModel();
    const address = await AModel.findById(booking.address_id).lean() as any;
    if (!address || !address.coordinates || !address.coordinates.coordinates) {
        console.error(`[DISPATCH] Critical: Address coordinates absent for booking ${bookingId}`);
        return;
    }

    const userPincode = address.pincode;
    const [userLng, userLat] = address.coordinates.coordinates;

    // Step 1: Validate service match
    const PSModel = getProviderServiceModel();
    const providerServices = await PSModel.find({
      subservice_ids: booking.subservice_id,
      is_active: true,
      isDeleted: false
    }).select('provider_id').lean();

    const qualifiedIds = providerServices.map((ps: any) => ps.provider_id);
    if (qualifiedIds.length === 0) {
        console.log(`[DISPATCH] No qualified providers found for subservice ${booking.subservice_id}`);
        return;
    }

    const PModel = getProviderModel();
    
    // Step 2 & 4: KYC verification and Online status
    let candidates = await PModel.find({
      _id: { $in: qualifiedIds },
      kyc_status: 'verified',
      isOnline: true,
      isDeleted: false
    }).lean() as any[];

    if (candidates.length === 0) {
      console.log(`[DISPATCH] No verified online providers for booking ${bookingId}`);
      return;
    }

    // Step 3: Provider account status
    const UModel = getUserModel();
    const activeUsers = await UModel.find({
      _id: { $in: candidates.map(c => c.user_id) },
      status: 'active',
      isDeleted: false
    }).select('_id').lean() as any[];
    
    const activeUserIds = new Set(activeUsers.map(u => String(u._id)));
    candidates = candidates.filter(c => activeUserIds.has(String(c.user_id)));

    if (candidates.length === 0) {
      console.log(`[DISPATCH] No active providers for booking ${bookingId}`);
      return;
    }

    // Step 5: Booking slot availability check (Exclude providers with conflicting bookings)
    const conflictingBookings = await Booking.find({
      provider_id: { $in: candidates.map(c => c._id) },
      scheduled_at: booking.scheduled_at,
      booking_time: booking.booking_time,
      status: { $in: ['accepted', 'ongoing'] },
      isDeleted: false
    }).select('provider_id').lean();
    
    const busyProviderIds = new Set(conflictingBookings.map(b => String(b.provider_id)));
    candidates = candidates.filter(c => !busyProviderIds.has(String(c._id)));

    if (candidates.length === 0) {
      console.log(`[DISPATCH] All matching providers are busy for slot ${booking.booking_time}`);
      return;
    }

    // Step 6: Location matching (PRIMARY LOGIC: PINCODE)
    const LModel = getLocationModel();
    const locationIds = [...new Set(candidates.flatMap(c => c.service_locations || []))];
    const locations = await LModel.find({ _id: { $in: locationIds } }).select('_id pincode').lean() as any[];
    const locMap = new Map(locations.map(l => [String(l._id), l.pincode]));

    let primaryMatches: any[] = [];
    let fallbackMatches: any[] = [];

    for (const provider of candidates) {
      let isPrimaryMatch = false;
      if (provider.service_locations && provider.service_locations.length > 0) {
        for (const locId of provider.service_locations) {
          const pCode = locMap.get(String(locId));
          if (pCode && userPincode && pCode === userPincode) {
            isPrimaryMatch = true;
            break;
          }
        }
      }

      if (isPrimaryMatch) {
        primaryMatches.push({ ...provider, matchType: 'pincode', distance: 0 });
      } else {
        // Fallback matching: Geospatial (10-15 KM)
        if (provider.live_location && provider.live_location.coordinates) {
          const [pLng, pLat] = provider.live_location.coordinates;
          const dist = getHaversineDistance(userLng, userLat, pLng, pLat);
          const maxDist = provider.serviceRadius || 15000; // 15km default fallback radius
          if (dist <= maxDist) {
            fallbackMatches.push({ ...provider, matchType: 'geo', distance: dist });
          }
        }
      }
    }

    let finalCandidates = primaryMatches.length > 0 ? primaryMatches : fallbackMatches;

    console.log(`[DISPATCH] Found ${finalCandidates.length} candidate providers for booking ${booking.booking_id} (Primary matches: ${primaryMatches.length}, Fallback: ${fallbackMatches.length})`);

    if (finalCandidates.length === 0) {
        return;
    }

    // Dynamic Membership Feature: Top Listing & Priority Dispatch
    try {
      const activeProviderUserIds = finalCandidates.map(c => new mongoose.Types.ObjectId(c.user_id));
      const UMModel = getPaymentDb().model('UserMembership', new Schema({}, { strict: false }), 'usermemberships');
      const MModel = getCatalogDb().model('Membership', new Schema({}, { strict: false }), 'memberships');

      const activeMemberships = await UMModel.find({
          user_id: { $in: activeProviderUserIds },
          membership_status: 'active'
      }).lean() as any[];

      const membershipIds = activeMemberships.map((m: any) => m.membership_id);
      const memberships = await MModel.find({ _id: { $in: membershipIds } }).lean() as any[];
      const membershipMap = new Map(memberships.map((m: any) => [String(m._id), m]));

      for (const provider of finalCandidates) {
         // Base score based on distance and match type
         provider.dispatchScore = provider.matchType === 'pincode' ? 50000 : (15000 - provider.distance);
         
         const um = activeMemberships.find((m: any) => String(m.user_id) === String(provider.user_id));
         if (um) {
             const mem = membershipMap.get(String(um.membership_id));
             if (mem && mem.role === 'provider') {
                 // If provider has premium routing features, dramatically boost their dispatch score
                 if (mem.providerConfig?.priorityDispatch || mem.providerConfig?.featuredListing) {
                     provider.dispatchScore += 100000;
                 }
             }
         }
      }

      // Sort by dynamic dispatch score descending
      finalCandidates.sort((a, b) => b.dispatchScore - a.dispatchScore);
    } catch(err) {
      console.log(`[DISPATCH] Provider membership extraction failed:`, err);
      // Fallback sorting
      if (primaryMatches.length === 0) {
        finalCandidates.sort((a, b) => a.distance - b.distance);
      }
    }
    
    // Create Job Requests
    const JRModel = getJobRequestModel();

    for (const provider of finalCandidates) {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const exists = await JRModel.findOne({ booking_id: booking._id, provider_id: provider._id });
      if (exists) continue;

      const jobRequest = await JRModel.create({
        booking_id: booking._id,
        provider_id: provider._id,
        expires_at: expiresAt,
        distance: Math.round(provider.distance), 
        status: 'pending'
      });

      emitToProviderServiceSocket(provider.user_id.toString(), 'new_job_request', {
        request_id: jobRequest._id,
        booking_id: booking._id,
        display_id: booking.booking_id,
        service_name: booking.variant_name || 'New Service Request',
        amount: booking.payable_amount,
        location: {
            address: address.address_line,
            city: address.city,
            pincode: address.pincode,
            distance: provider.matchType === 'geo' ? (provider.distance / 1000).toFixed(1) + ' km' : 'Exact Pincode Match'
        },
        scheduled_at: booking.scheduled_at,
        booking_time: booking.booking_time,
        expires_at: expiresAt
      });
    }

  } catch (error) {
    console.error('[DISPATCH] Matching pipeline error:', error);
  }
};

export const dispatchBooking = dispatchNearbyProviders;
