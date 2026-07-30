import { Request, Response } from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import { Provider } from '../models/Provider';
import { ProviderLocation } from '../models/ProviderLocation';
import { ProviderService } from '../models/ProviderService';
import { JobRequest } from '../models/JobRequest';
import { WalletTransaction } from '../models/WalletTransaction';
import { LeadFeeConfig } from '../models/LeadFeeConfig';
import { LeadPackageOrder } from '../models/LeadPackageOrder';
import { DispatchSetting } from '../models/DispatchSetting';
import { emitToUser } from '../services/socketService';
import { getUsersBatch, sendProviderNotification } from '../utils/internalApi';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';

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

    const graceMinutes = Number(process.env.BOOKING_START_GRACE_MINUTES) || 60;
    const graceMs = graceMinutes * 60 * 1000;
    if (booking.scheduled_at && new Date(booking.scheduled_at).getTime() < (Date.now() - graceMs)) {
      console.log(`[DISPATCH] ⛔ Refusing stale booking ${booking._id || booking.booking_id} (scheduled: ${booking.scheduled_at})`);
      res.json({ message: 'Booking is past scheduled grace period', provider_id: null, stale: true });
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



    const feeConfig = await LeadFeeConfig.findOne({ subservice_id: booking.subservice_id });
    const leadFee = feeConfig ? feeConfig.lead_fee : 100;

    let bestProvider: any = null;

    // ── TIER 1: Online + Verified + Not Busy + GPS within 30km ─────────────────
    try {
      const tier1 = await ProviderLocation.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [userLng, userLat] },
            distanceField: 'distance',
            maxDistance: 30000,
            spherical: true,
            query: {
              provider_id: { $in: qualifiedIds },
              isOnline: true,
              currentStatus: 'idle'
            }
          }
        },
        {
          $lookup: {
            from: 'providers',
            localField: 'provider_id',
            foreignField: '_id',
            as: 'providerDetails'
          }
        },
        { $unwind: '$providerDetails' },
        {
          $match: {
            'providerDetails.kyc_status': 'verified',
            'providerDetails.isDeleted': false,
            'providerDetails.isWalletBlocked': { $ne: true },
            $or: [
              { 'providerDetails.isFreeAccessEnabled': true },
              {
                $and: [
                  { 'providerDetails.kitPurchased': true },
                  {
                    $expr: {
                      $gte: [
                        { $add: [
                          { $subtract: ["$providerDetails.walletBalance", "$providerDetails.reservedBalance"] },
                          { $ifNull: ["$providerDetails.creditLimit", 0] }
                        ]},
                        leadFee
                      ]
                    }
                  }
                ]
              }
            ]
          }
        },
        {
          $project: {
            _id: '$providerDetails._id',
            user_id: '$providerDetails.user_id',
            availability_status: '$providerDetails.availability_status',
            isOnline: '$providerDetails.isOnline',
            isBusy: '$providerDetails.isBusy',
            kyc_status: '$providerDetails.kyc_status',
            kitPurchased: '$providerDetails.kitPurchased',
            walletBalance: '$providerDetails.walletBalance',
            reservedBalance: '$providerDetails.reservedBalance',
            creditLimit: '$providerDetails.creditLimit',
            isWalletBlocked: '$providerDetails.isWalletBlocked',
            live_location: '$providerDetails.live_location',
            distance: 1
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
        const tier2 = await ProviderLocation.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [userLng, userLat] },
              distanceField: 'distance',
              maxDistance: 30000,
              spherical: true,
              query: {
                provider_id: { $in: qualifiedIds }
              }
            }
          },
          {
            $lookup: {
              from: 'providers',
              localField: 'provider_id',
              foreignField: '_id',
              as: 'providerDetails'
            }
          },
          { $unwind: '$providerDetails' },
          {
            $match: {
              'providerDetails.kyc_status': 'verified',
              'providerDetails.isDeleted': false,
              'providerDetails.isWalletBlocked': { $ne: true },
              $or: [
                { 'providerDetails.isFreeAccessEnabled': true },
                {
                  $and: [
                    { 'providerDetails.kitPurchased': true },
                    {
                      $expr: {
                        $gte: [
                          { $add: [
                            { $subtract: ["$providerDetails.walletBalance", "$providerDetails.reservedBalance"] },
                            { $ifNull: ["$providerDetails.creditLimit", 0] }
                          ]},
                          leadFee
                        ]
                      }
                    }
                  ]
                }
              ]
            }
          },
          {
            $project: {
              _id: '$providerDetails._id',
              user_id: '$providerDetails.user_id',
              availability_status: '$providerDetails.availability_status',
              isOnline: '$providerDetails.isOnline',
              isBusy: '$providerDetails.isBusy',
              kyc_status: '$providerDetails.kyc_status',
              kitPurchased: '$providerDetails.kitPurchased',
              walletBalance: '$providerDetails.walletBalance',
              reservedBalance: '$providerDetails.reservedBalance',
              creditLimit: '$providerDetails.creditLimit',
              isWalletBlocked: '$providerDetails.isWalletBlocked',
              live_location: '$providerDetails.live_location',
              distance: 1
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
        isWalletBlocked: { $ne: true },
        $or: [
          { isFreeAccessEnabled: true },
          {
            $and: [
              { kitPurchased: true },
              {
                $expr: {
                  $gte: [
                    { $add: [
                      { $subtract: ["$walletBalance", "$reservedBalance"] },
                      { $ifNull: ["$creditLimit", 0] }
                    ]},
                    leadFee
                  ]
                }
              }
            ]
          }
        ]
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
        isWalletBlocked: { $ne: true },
        $or: [
          { isFreeAccessEnabled: true },
          {
            $and: [
              { kitPurchased: true },
              {
                $expr: {
                  $gte: [
                    { $add: [
                      { $subtract: ["$walletBalance", "$reservedBalance"] },
                      { $ifNull: ["$creditLimit", 0] }
                    ]},
                    leadFee
                  ]
                }
              }
            ]
          }
        ]
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

    // Send provider database notification
    sendProviderNotification(
      String(bestProvider.user_id),
      'New Booking Request',
      `You have received a new booking request for ${booking.variant_name || 'Service'} of ₹${booking.payable_amount}.`,
      'booking_alert',
      { booking_id: booking._id, request_id: jobRequest._id }
    ).catch(err => console.error('[NOTIFICATION] Failed to send new booking notification:', err));

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
    const subserviceIds = bookings.map((b: any) => b.subservice_id);

    const providerServices = await ProviderService.find({
      subservice_ids: { $in: subserviceIds },
      is_active: true,
      isDeleted: false
    }).select('provider_id location_ids subservice_ids').lean() as any[];

    let allQualifiedIds: string[] = [];
    if (providerServices.length > 0) {
      allQualifiedIds = [...new Set(providerServices.map((ps: any) => String(ps.provider_id)))];
    } else {
      const allVerified = await Provider.find({
        kyc_status: 'verified',
        isDeleted: false,
        kitPurchased: true,
        isWalletBlocked: { $ne: true }
      }).select('_id').lean();
      allQualifiedIds = allVerified.map((p: any) => String(p._id));
    }

    // Pre-fetch lead fee configurations
    const feeConfigs = await LeadFeeConfig.find({}).lean();
    const feeMap = new Map<string, number>();
    for (const fc of feeConfigs as any[]) {
      feeMap.set(String(fc.subservice_id), fc.lead_fee);
    }

    // Build location_ids map per provider
    const providerLocationMap = new Map<string, string[]>();
    for (const ps of providerServices) {
      const existing = providerLocationMap.get(String(ps.provider_id)) || [];
      providerLocationMap.set(String(ps.provider_id), [...existing, ...(ps.location_ids || []).map(String)]);
    }



    let nearbyProviders: any[] = [];
    try {
      nearbyProviders = await ProviderLocation.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [userLng, userLat] },
            distanceField: 'distance',
            maxDistance: 30000,
            spherical: true,
            query: {
              provider_id: { $in: allQualifiedIds.map(id => new mongoose.Types.ObjectId(id)) },
              isOnline: true
            }
          }
        },
        {
          $lookup: {
            from: 'providers',
            localField: 'provider_id',
            foreignField: '_id',
            as: 'providerDetails'
          }
        },
        { $unwind: '$providerDetails' },
        {
          $match: {
            'providerDetails.kyc_status': 'verified',
            'providerDetails.isDeleted': false,
            'providerDetails.isWalletBlocked': { $ne: true },
            $or: [
              { 'providerDetails.isFreeAccessEnabled': true },
              {
                $and: [
                  { 'providerDetails.kitPurchased': true },
                  {
                    $expr: {
                      $gte: [
                        { $add: [
                          { $subtract: ["$providerDetails.walletBalance", "$providerDetails.reservedBalance"] },
                          { $ifNull: ["$providerDetails.creditLimit", 0] }
                        ]},
                        0
                      ]
                    }
                  }
                ]
              }
            ]
          }
        },
        {
          $project: {
            _id: '$providerDetails._id',
            user_id: '$providerDetails.user_id',
            availability_status: '$providerDetails.availability_status',
            isOnline: '$providerDetails.isOnline',
            isBusy: '$providerDetails.isBusy',
            kyc_status: '$providerDetails.kyc_status',
            kitPurchased: '$providerDetails.kitPurchased',
            walletBalance: '$providerDetails.walletBalance',
            reservedBalance: '$providerDetails.reservedBalance',
            creditLimit: '$providerDetails.creditLimit',
            isWalletBlocked: '$providerDetails.isWalletBlocked',
            isFreeAccessEnabled: '$providerDetails.isFreeAccessEnabled',
            freeAccessStartDate: '$providerDetails.freeAccessStartDate',
            freeAccessEndDate: '$providerDetails.freeAccessEndDate',
            gracePeriodEndDate: '$providerDetails.gracePeriodEndDate',
            subscriptionType: '$providerDetails.subscriptionType',
            accessMode: '$providerDetails.accessMode',
            subscriptionStatus: '$providerDetails.subscriptionStatus',
            live_location: '$providerDetails.live_location',
            distance: 1
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
      isWalletBlocked: { $ne: true },
      $or: [
        { isFreeAccessEnabled: true },
        {
          $and: [
            { kitPurchased: true },
            {
              $expr: {
                $gte: [
                  { $add: [
                    { $subtract: ["$walletBalance", "$reservedBalance"] },
                    { $ifNull: ["$creditLimit", 0] }
                  ]},
                  0
                ]
              }
            }
          ]
        }
      ]
    }).limit(100).lean();

    // Pre-fetch ALL candidate user accounts and Lead Package Orders in batch
    const allCandidates = [...nearbyProviders, ...allProvidersFallback];
    const allCandidateUserIds = [...new Set(allCandidates.map((p: any) => p.user_id.toString()))];
    const activeCandidateUsers = allCandidateUserIds.length > 0 ? await getUsersBatch(allCandidateUserIds) : [];
    const activeSet = new Set(activeCandidateUsers.map((u: any) => u._id.toString()));

    const candidateProviderObjectIds = allCandidates.map((p: any) => new mongoose.Types.ObjectId(p._id));
    const now = new Date();

    const [dispatchWeights, activeLeadOrders] = await Promise.all([
      DispatchSetting.findOne({}).lean(),
      LeadPackageOrder.find({
        provider_id: { $in: candidateProviderObjectIds },
        paymentStatus: 'success',
        leadsRemaining: { $gt: 0 },
        $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }]
      }).lean()
    ]);

    const weights: any = dispatchWeights || {
      distanceWeight: 40,
      ratingWeight: 20,
      priorityPackageWeight: 15,
      loadBalancingWeight: 15,
      recencyWeight: 10,
      maxConcurrentJobs: 3,
      responseTimeoutSeconds: 600
    };

    const providerLeadCountMap = new Map<string, number>();
    const providerPriorityMap = new Map<string, boolean>();

    for (const order of activeLeadOrders) {
      const pid = String(order.provider_id);
      providerLeadCountMap.set(pid, (providerLeadCountMap.get(pid) || 0) + order.leadsRemaining);
      if (order.hasPriorityDispatch) {
        providerPriorityMap.set(pid, true);
      }
    }

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

    const isFreeAccessActive = (p: any) => {
      if (!p.isFreeAccessEnabled) return false;
      if (p.freeAccessEndDate && new Date(p.freeAccessEndDate) < now) {
        if (p.gracePeriodEndDate && new Date(p.gracePeriodEndDate) >= now) {
          return true;
        }
        return false;
      }
      return true;
    };

    const hasCredit = (p: any, fee: number) => {
      if (isFreeAccessActive(p)) return true;
      const leads = providerLeadCountMap.get(String(p._id)) || 0;
      if (leads > 0) return true;
      return ((p.walletBalance || 0) - (p.reservedBalance || 0) + (p.creditLimit || 0)) >= fee;
    };

    const calculateDispatchScore = (p: any, distance: number) => {
      const distKm = Math.max(0, distance / 1000);
      const distanceScore = Math.max(0, 100 - (distKm * 5));

      const rating = p.overall_rating || 4.5;
      const ratingScore = (rating / 5) * 100;

      const isPriority = providerPriorityMap.get(String(p._id)) || p.accessMode === 'premium';
      const priorityScore = isPriority ? 100 : 0;

      const jobsToday = p.jobsAssignedToday || 0;
      const workloadScore = Math.max(0, 100 - (jobsToday * 10));

      let recencyScore = 100;
      if (p.lastJobAssignedAt) {
        const minsSince = Math.floor((Date.now() - new Date(p.lastJobAssignedAt).getTime()) / 60000);
        recencyScore = Math.min(100, minsSince * 2);
      }

      // Provider Cooldown Penalty
      const consecutiveJobs = p.consecutiveJobsToday || 0;
      const cooldownPenalty = consecutiveJobs >= (weights.cooldownConsecutiveLimit || 5) ? (weights.cooldownPenaltyFactor || 20) : 0;

      // Fraud Penalty Score
      const fraudPenalty = p.fraudPenaltyScore || ((p.rejectionCount30d || 0) * 2 + (p.cancellationCount30d || 0) * 5);

      let totalScore = 
        (distanceScore * ((weights.distanceWeight || 40) / 100)) +
        (ratingScore * ((weights.ratingWeight || 20) / 100)) +
        (priorityScore * ((weights.priorityPackageWeight || 15) / 100)) +
        (workloadScore * ((weights.loadBalancingWeight || 15) / 100)) +
        (recencyScore * ((weights.recencyWeight || 10) / 100));

      totalScore = Math.max(0, totalScore - cooldownPenalty - fraudPenalty);

      return totalScore;
    };

    for (const booking of bookings) {
      const leadFee = feeMap.get(String(booking.subservice_id)) || 100;

      const subserviceQualifiedIds = providerServices && providerServices.length > 0
        ? providerServices
            .filter(ps => (ps.subservice_ids || []).map(String).includes(String(booking.subservice_id)))
            .map(ps => String(ps.provider_id))
        : allQualifiedIds;

      // Dynamic Progressive Radius Expansion (5km -> 10km -> 20km -> 30km)
      const radiusRings = booking.is_emergency ? [30000] : [5000, 10000, 20000, 30000];
      let candidatePool: any[] = [];

      for (const radiusLimit of radiusRings) {
        candidatePool = [];
        for (const p of nearbyProviders) {
          const isAvailableState = p.availability_status === 'available' || !p.availability_status;
          if (
            subserviceQualifiedIds.includes(String(p._id)) &&
            activeSet.has(p.user_id.toString()) &&
            isAvailableState &&
            !p.isBusy &&
            (p.distance || 0) <= radiusLimit &&
            hasCredit(p, leadFee)
          ) {
            const score = calculateDispatchScore(p, p.distance || 0);
            candidatePool.push({ provider: p, score });
          }
        }
        if (candidatePool.length > 0) break; // Found candidates in current radius ring!
      }

      if (candidatePool.length === 0) {
        const userLocationId = address?.location_id ? String(address.location_id) : null;
        for (const p of allProvidersFallback) {
          const isAvailableState = p.availability_status === 'available' || !p.availability_status;
          if (!subserviceQualifiedIds.includes(String(p._id)) || !isAvailableState || p.isBusy) continue;
          const locationIds = providerLocationMap.get(String(p._id)) || [];
          if ((!userLocationId || locationIds.includes(userLocationId)) && hasCredit(p, leadFee)) {
            const score = calculateDispatchScore(p, 5000);
            candidatePool.push({ provider: { ...p, distance: 5000 }, score });
          }
        }
      }

      // Sort candidate pool by weighted dispatch score (descending)
      candidatePool.sort((a, b) => b.score - a.score);

      const bestCandidate = candidatePool[0];
      const bestProvider = bestCandidate ? bestCandidate.provider : null;

      if (bestProvider) {
        const expiresAt = new Date(Date.now() + (weights.responseTimeoutSeconds || 600) * 1000);
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

          // Update workload & recency metrics on Provider
          await Provider.findByIdAndUpdate(bestProvider._id, {
            $inc: { jobsAssignedToday: 1 },
            $set: { lastJobAssignedAt: new Date() }
          });

          // Enforce Hold Reservation ONLY for cash wallet (waived for free access or active leads)
          const feeConfig = await LeadFeeConfig.findOne({ subservice_id: booking.subservice_id });
          const leadFee = feeConfig ? feeConfig.lead_fee : 100;
          const providerDoc = await Provider.findById(bestProvider._id);

          const availableLeads = providerLeadCountMap.get(String(bestProvider._id)) || 0;

          if (providerDoc && !isFreeAccessActive(providerDoc) && availableLeads === 0) {
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

        // Send provider database notification
        sendProviderNotification(
          String(bestProvider.user_id),
          'New Booking Request',
          `You have received a new booking request for ${booking.variant_name || 'Service'} of ₹${booking.payable_amount}.`,
          'booking_alert',
          { booking_id: booking._id, request_id: jobRequest._id }
        ).catch(err => console.error('[NOTIFICATION] Failed to send new booking notification in batch:', err));

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
