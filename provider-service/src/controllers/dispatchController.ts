import { Request, Response } from 'express';
import { getDb } from '../config/db';
import { ProviderRepository } from '../repositories/providerRepository';
import { JobRequestRepository } from '../repositories/jobRequestRepository';
import { WalletRepository } from '../repositories/walletRepository';
import { scheduleEngine } from '../services/schedule/ScheduleEngine';
import { emitToUser } from '../services/socketService';
import { getUsersBatch, sendProviderNotification, getBookingsBatch, getAddressesBatch, getCatalogBatch } from '../utils/internalApi';
import { getDispatchConfig, calcJobRequestExpiry } from '../utils/dispatchExpiry';

/**
 * Helper to check if two bookings conflict in date and time slot.
 */
export const isScheduleConflicting = (
  scheduledAt1: Date | string | undefined,
  bookingTime1: string | undefined,
  scheduledAt2: Date | string | undefined,
  bookingTime2: string | undefined
): boolean => {
  if (!scheduledAt1 || !scheduledAt2) return false;

  const d1 = new Date(scheduledAt1);
  const d2 = new Date(scheduledAt2);

  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;

  const sameDate =
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate();

  if (!sameDate) return false;

  if (!bookingTime1 || !bookingTime2) return true;

  const t1 = String(bookingTime1).trim().toLowerCase();
  const t2 = String(bookingTime2).trim().toLowerCase();

  if (t1 === t2) return true;

  const extractMinutes = (str: string) => {
    const match = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3] ? match[3].toLowerCase() : null;
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return h * 60 + m;
  };

  const min1 = extractMinutes(t1);
  const min2 = extractMinutes(t2);

  if (min1 !== null && min2 !== null) {
    return Math.abs(min1 - min2) < 60;
  }

  return true;
};

export const parseBookingStart = (scheduledAt?: Date | string, bookingTime?: string): Date => {
  const date = scheduledAt ? new Date(scheduledAt) : new Date();
  if (isNaN(date.getTime())) return new Date();

  if (bookingTime) {
    const match = String(bookingTime).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2] ? parseInt(match[2], 10) : 0;
      const period = match[3] ? match[3].toLowerCase() : null;
      if (period === 'pm' && h < 12) h += 12;
      if (period === 'am' && h === 12) h = 0;
      date.setHours(h, m, 0, 0);
    }
  }
  return date;
};

/**
 * Filter out candidate providers who are already booked or have calendar conflicts for the requested date & time.
 */
export const filterConflictingProviders = async (
  candidateProviders: any[],
  scheduledAt: Date | string | undefined,
  bookingTime: string | undefined,
  excludeBookingId?: string,
  travelMinutes: number = 15,
  subserviceId?: string
): Promise<any[]> => {
  if (!candidateProviders || candidateProviders.length === 0) return [];
  if (!scheduledAt) return candidateProviders;

  const bookingStart = parseBookingStart(scheduledAt, bookingTime);
  const buffers = await scheduleEngine.resolveBuffers(subserviceId);

  const availableProviders: any[] = [];
  const db = getDb();

  for (const provider of candidateProviders) {
    const pId = String(provider.id || provider._id || provider);
    const fitResult = await scheduleEngine.canBookingFit(
      pId,
      bookingStart,
      60,
      travelMinutes,
      buffers
    );

    if (fitResult.fits) {
      // Legacy fallback check on active requests without calendar blocks
      try {
        const activeRes = await db.query(
          `SELECT booking_id FROM provider.job_requests
           WHERE (provider_id::text = $1 OR legacy_mongo_id = $1)
             AND status IN ('accepted', 'pending')`,
          [pId]
        );
        const activeRequests = activeRes.rows;

        let hasLegacyConflict = false;
        if (activeRequests.length > 0) {
          const bookingIds = [...new Set(activeRequests.map((r: any) => String(r.booking_id)).filter(Boolean))];
          const bookings = await getBookingsBatch(bookingIds);
          for (const b of bookings) {
            if (excludeBookingId && (String(b.id || b._id) === String(excludeBookingId) || String(b.booking_id) === String(excludeBookingId))) continue;
            const activeStatuses = ['accepted', 'on_the_way', 'arrived', 'in_progress', 'waiting_start_otp', 'waiting_end_otp', 'service_completed', 'provider_searching', 'pending'];
            if (activeStatuses.includes(b.status) && isScheduleConflicting(b.scheduled_at, b.booking_time, scheduledAt, bookingTime)) {
              hasLegacyConflict = true;
              break;
            }
          }
        }

        if (!hasLegacyConflict) {
          availableProviders.push(provider);
        }
      } catch (_) {
        availableProviders.push(provider);
      }
    }
  }

  return availableProviders;
};

// @desc    Internal API to dispatch booking to nearby providers
// @route   POST /api/providers/internal/dispatch
// @access  Internal
export const dispatchToProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    let { booking, address } = req.body;

    if (!booking && req.body.booking_id) {
      const bookings = await getBookingsBatch([req.body.booking_id]);
      if (bookings.length > 0) {
        booking = bookings[0];
      }
    }
    if (booking && !address && booking.address_id) {
      const addresses = await getAddressesBatch([String(booking.address_id)]);
      if (addresses.length > 0) {
        address = addresses[0];
      }
    }

    if (!booking || !address) {
      res.status(400).json({ message: 'Booking and address required' });
      return;
    }

    const graceMinutes = Number(process.env.BOOKING_START_GRACE_MINUTES) || 60;
    const graceMs = graceMinutes * 60 * 1000;
    if (booking.scheduled_at && new Date(booking.scheduled_at).getTime() < (Date.now() - graceMs)) {
      console.log(`[DISPATCH] ⛔ Refusing stale booking ${booking.id || booking._id || booking.booking_id} (scheduled: ${booking.scheduled_at})`);
      res.json({ message: 'Booking is past scheduled grace period', provider_id: null, stale: true });
      return;
    }

    const coords = address?.location?.coordinates || address?.coordinates?.coordinates;
    const hasRealCoords = Array.isArray(coords) && coords.length >= 2 && !(coords[0] === 0 && coords[1] === 0);

    const userLng = hasRealCoords ? Number(coords[0]) : 77.5946;
    const userLat = hasRealCoords ? Number(coords[1]) : 12.9716;

    const bookingIdStr = String(booking.id || booking._id || booking.booking_id);

    // Exclude already-offered providers for this booking
    const existingReqsRes = await db.query(
      `SELECT provider_id FROM provider.job_requests WHERE booking_id::text = $1`,
      [bookingIdStr]
    );
    const alreadyOfferedIds = new Set(existingReqsRes.rows.map((r: any) => String(r.provider_id)));

    // Fetch providers registered for this subservice
    const subserviceIdStr = String(booking.subservice_id);
    const providerServicesRes = await db.query(
      `SELECT ps.id, ps.provider_id
       FROM provider.provider_services ps
       INNER JOIN provider.provider_service_subservices pss ON pss.provider_service_id = ps.id
       WHERE (pss.subservice_id::text = $1)
         AND ps.is_active = TRUE`,
      [subserviceIdStr]
    );

    let providerServices = providerServicesRes.rows;
    if (alreadyOfferedIds.size > 0) {
      providerServices = providerServices.filter((ps: any) => !alreadyOfferedIds.has(String(ps.provider_id)));
    }

    if (providerServices.length === 0) {
      console.log(`[SUPPLY GAP] Zero registered providers found for booking ${booking.booking_id || bookingIdStr} (subservice: ${booking.subservice_id}).`);
      res.json({ message: 'No registered providers found for this service', provider_id: null });
      return;
    }

    const normalizeGender = (g?: string | null): 'MALE' | 'FEMALE' | 'ANY' => {
      if (!g) return 'ANY';
      const up = g.trim().toUpperCase();
      if (up === 'MALE' || up === 'MEN' || up === 'MAN') return 'MALE';
      if (up === 'FEMALE' || up === 'WOMEN' || up === 'WOMAN') return 'FEMALE';
      return 'ANY';
    };

    const isSalonService = (sub?: any): boolean => {
      if (!sub) return false;
      const cat = String(sub.category_name || sub.category_id || '').toUpperCase();
      const name = String(sub.subservice_name || sub.name || '').toUpperCase();
      return cat.includes('SALON') || cat.includes('BEAUTY') || cat.includes('GROOMING') ||
             name.includes('HAIRCUT') || name.includes('FACIAL') || name.includes('BEARD') || name.includes('WAXING') || name.includes('MAKEUP');
    };

    const catalogData = await getCatalogBatch([subserviceIdStr], [], [], []).catch(() => ({ subservices: [] }));
    const subservice = catalogData.subservices?.[0];
    
    const catReqGender = isSalonService(subservice) 
      ? normalizeGender(subservice?.required_gender || subservice?.genderApplicability)
      : 'ANY';
    const bookPrefGender = normalizeGender(booking.preferred_gender);

    let effectiveGender: 'MALE' | 'FEMALE' | 'ANY' = catReqGender;
    if (catReqGender === 'ANY' && bookPrefGender !== 'ANY') {
      effectiveGender = bookPrefGender;
    }

    const qualifiedIds = providerServices.map((ps: any) => String(ps.provider_id));

    // Lead fee config
    const feeRes = await db.query(
      `SELECT fee_amount FROM provider.lead_fee_configs WHERE (category_id::text = $1) LIMIT 1`,
      [subserviceIdStr]
    );
    const leadFee = feeRes.rows[0] ? Number(feeRes.rows[0].fee_amount) : 100;

    let bestProvider: any = null;

    // ── TIER 1: Online + Verified + Not Busy + GPS within 30km ─────────────────
    try {
      const candidates = await ProviderRepository.findNearby({
        latitude: userLat,
        longitude: userLng,
        radiusMeters: 30000,
        subserviceId: subserviceIdStr,
        onlyAvailable: true,
        gender: effectiveGender
      });

      const eligibleTier1 = candidates.filter(p => {
        if (alreadyOfferedIds.has(String(p.id))) return false;
        if (p.is_wallet_blocked) return false;
        const availableBalance = (p.wallet_balance - p.reserved_balance) + p.credit_limit;
        return availableBalance >= leadFee || p.subscription_type === 'free_access';
      });

      if (eligibleTier1.length > 0) {
        const availableTier1 = await filterConflictingProviders(eligibleTier1, booking.scheduled_at, booking.booking_time);
        if (availableTier1.length > 0) {
          const t1UserIds = availableTier1.map((c: any) => String(c.user_id));
          const activeUsers = await getUsersBatch(t1UserIds).catch(() => []);
          const activeSet = new Set(activeUsers.map((u: any) => String(u.id || u._id)));
          bestProvider = availableTier1.find((c: any) => activeSet.has(String(c.user_id))) ?? availableTier1[0];
          if (bestProvider) bestProvider.distance = bestProvider.distance_meters || 0;
        }
      }
    } catch (e: any) {
      console.warn(`[DISPATCH] Tier 1 error: ${e.message}`);
    }

    // ── TIER 2: Verified (offline OK) + GPS within 30km ────────────────────────
    if (!bestProvider) {
      try {
        const candidates = await ProviderRepository.findNearby({
          latitude: userLat,
          longitude: userLng,
          radiusMeters: 30000,
          subserviceId: subserviceIdStr,
          onlyAvailable: false,
          gender: effectiveGender
        });

        const eligibleTier2 = candidates.filter(p => {
          if (alreadyOfferedIds.has(String(p.id))) return false;
          if (p.is_wallet_blocked) return false;
          const availableBalance = (p.wallet_balance - p.reserved_balance) + p.credit_limit;
          return availableBalance >= leadFee || p.subscription_type === 'free_access';
        });

        if (eligibleTier2.length > 0) {
          const availableTier2 = await filterConflictingProviders(eligibleTier2, booking.scheduled_at, booking.booking_time);
          if (availableTier2.length > 0) {
            const t2UserIds = availableTier2.map((c: any) => String(c.user_id));
            const activeUsers = await getUsersBatch(t2UserIds).catch(() => []);
            const activeSet = new Set(activeUsers.map((u: any) => String(u.id || u._id)));
            bestProvider = availableTier2.find((c: any) => activeSet.has(String(c.user_id))) ?? availableTier2[0];
            if (bestProvider) bestProvider.distance = bestProvider.distance_meters || 0;
          }
        }
      } catch (e: any) {
        console.warn(`[DISPATCH] Tier 2 error: ${e.message}`);
      }
    }

    // ── TIER 3: Any verified provider for this subservice (fallback) ───────────
    if (!bestProvider) {
      try {
        const t3Res = await db.query(
          `SELECT p.*, 0 as distance_meters
           FROM provider.providers p
           WHERE p.id::text = ANY($1)
             AND p.kyc_status = 'verified'
             AND p.status = 'active'
             AND p.deleted_at IS NULL
             AND (p.is_wallet_blocked = FALSE OR p.subscription_type = 'free_access')
           LIMIT 50`,
          [qualifiedIds]
        );
        const t3Matches = t3Res.rows.map(r => ({ ...r, id: String(r.id), _id: String(r.id), distance: 0 }));

        if (t3Matches.length > 0) {
          const availableTier3 = await filterConflictingProviders(t3Matches, booking.scheduled_at, booking.booking_time);
          if (availableTier3.length > 0) {
            const t3UserIds = availableTier3.map((c: any) => String(c.user_id));
            const activeUsers = await getUsersBatch(t3UserIds).catch(() => []);
            const activeSet = new Set(activeUsers.map((u: any) => String(u.id || u._id)));
            bestProvider = availableTier3.find((c: any) => activeSet.has(String(c.user_id))) ?? availableTier3[0];
          }
        }
      } catch (e: any) {
        console.warn(`[DISPATCH] Tier 3 error: ${e.message}`);
      }
    }

    if (!bestProvider) {
      res.json({ message: 'No provider found', provider_id: null });
      return;
    }

    const config = await getDispatchConfig();
    if (booking.provider_search_expires_at &&
        new Date(booking.provider_search_expires_at) <= new Date()) {
      res.json({ message: 'Booking search expired', provider_id: null });
      return;
    }
    const timeoutSec = config.tier1Timeout || config.acceptanceSec;
    const expiresAt = booking.provider_search_expires_at
      ? calcJobRequestExpiry(new Date(booking.provider_search_expires_at), timeoutSec)
      : new Date(Date.now() + timeoutSec * 1000);

    const providerIdStr = String(bestProvider.id || bestProvider._id);

    let jobRequest = await JobRequestRepository.findByBookingAndProvider(bookingIdStr, providerIdStr);
    
    if (!jobRequest) {
      const distMeters = Math.round(bestProvider.distance || 0);
      const distKm = distMeters > 0 ? Math.round((distMeters / 1000) * 10) / 10 : 3.0;
      const estMins = Math.max(5, Math.round((distKm / 25) * 60));

      jobRequest = await JobRequestRepository.create({
        bookingId: bookingIdStr,
        providerId: providerIdStr,
        status: 'pending'
      });

      // Enforce Hold Reservation
      try {
        await WalletRepository.recordTransaction({
          providerId: providerIdStr,
          type: 'hold',
          amount: leadFee,
          referenceType: 'booking_lead_fee',
          referenceId: bookingIdStr,
          description: `Hold lead fee for booking dispatch #${booking.booking_id || bookingIdStr}`
        });
      } catch (err: any) {
        console.warn(`[DISPATCH] Hold transaction error: ${err.message}`);
      }
    }

    // Emit Socket Events
    if (jobRequest) {
      emitToUser(String(bestProvider.user_id), 'booking_assigned', {
        request_id: jobRequest.id,
        booking_id: bookingIdStr,
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

      sendProviderNotification(
        String(bestProvider.user_id),
        'New Booking Request',
        `You have received a new booking request for ${booking.variant_name || 'Service'} of ₹${booking.payable_amount}.`,
        'booking_alert',
        { booking_id: bookingIdStr, request_id: jobRequest.id }
      ).catch(err => console.error('[NOTIFICATION] Failed to send new booking notification:', err));
    }

    emitToUser(String(booking.user_id), 'booking_status_update', {
      booking_id: bookingIdStr,
      status: 'provider_searching',
      message: 'A provider has been found! Waiting for their confirmation.'
    });

    res.json({ message: 'Dispatched successfully', provider_id: providerIdStr });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Internal API to dispatch multiple bookings to nearby providers
// @route   POST /api/providers/internal/dispatch-batch
// @access  Internal
export const dispatchBatchToProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { bookings, address } = req.body;

    if (!bookings || !Array.isArray(bookings) || bookings.length === 0 || !address) {
      res.status(400).json({ message: 'Bookings array and address required' });
      return;
    }

    const coords = address?.location?.coordinates || address?.coordinates?.coordinates;
    const hasRealCoords = Array.isArray(coords) && coords.length >= 2 && !(coords[0] === 0 && coords[1] === 0);

    const userLng = hasRealCoords ? Number(coords[0]) : 77.5946;
    const userLat = hasRealCoords ? Number(coords[1]) : 12.9716;

    const results = [];

    for (const booking of bookings) {
      const subserviceIdStr = String(booking.subservice_id);
      const bookingIdStr = String(booking.id || booking._id || booking.booking_id);

      const feeRes = await db.query(
        `SELECT fee_amount FROM provider.lead_fee_configs WHERE (category_id::text = $1) LIMIT 1`,
        [subserviceIdStr]
      );
      const leadFee = feeRes.rows[0] ? Number(feeRes.rows[0].fee_amount) : 100;

      const candidates = await ProviderRepository.findNearby({
        latitude: userLat,
        longitude: userLng,
        radiusMeters: 30000,
        subserviceId: subserviceIdStr,
        onlyAvailable: true
      });

      const eligibleCandidates = candidates.filter(p => {
        if (p.is_wallet_blocked) return false;
        const netBalance = (p.wallet_balance - p.reserved_balance) + p.credit_limit;
        return netBalance >= leadFee || p.subscription_type === 'free_access';
      });

      let bestProvider: any = null;
      if (eligibleCandidates.length > 0) {
        const available = await filterConflictingProviders(eligibleCandidates, booking.scheduled_at, booking.booking_time);
        if (available.length > 0) {
          bestProvider = available[0];
          bestProvider.distance = bestProvider.distance_meters || 0;
        }
      }

      if (bestProvider) {
        const providerIdStr = String(bestProvider.id || bestProvider._id);
        const timeoutSec = 90;
        const expiresAt = booking.provider_search_expires_at
          ? calcJobRequestExpiry(new Date(booking.provider_search_expires_at), timeoutSec)
          : new Date(Date.now() + timeoutSec * 1000);

        let jobRequest = await JobRequestRepository.findByBookingAndProvider(bookingIdStr, providerIdStr);
        if (!jobRequest) {
          jobRequest = await JobRequestRepository.create({
            bookingId: bookingIdStr,
            providerId: providerIdStr,
            status: 'pending'
          });

          try {
            await WalletRepository.recordTransaction({
              providerId: providerIdStr,
              type: 'hold',
              amount: leadFee,
              referenceType: 'booking_batch_lead_fee',
              referenceId: bookingIdStr,
              description: `Hold lead fee for booking batch dispatch #${booking.booking_id || bookingIdStr}`
            });
          } catch (err: any) {
            console.warn(`[DISPATCH BATCH] Hold error: ${err.message}`);
          }
        }

        emitToUser(String(bestProvider.user_id), 'booking_assigned', {
          request_id: jobRequest.id,
          booking_id: bookingIdStr,
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

        results.push({ booking_id: bookingIdStr, provider_id: providerIdStr });
      } else {
        results.push({ booking_id: bookingIdStr, provider_id: null });
      }
    }

    res.json({ message: 'Batch dispatched successfully', results });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Internal API to validate candidate provider availability for a multi-service timeline
// @route   POST /api/providers/internal/validate-multi-schedule
// @access  Internal / Public
export const validateMultiSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { subservice_ids, items } = req.body;

    if (!Array.isArray(subservice_ids) || subservice_ids.length === 0 || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ available: false, message: 'subservice_ids and items arrays are required' });
      return;
    }

    const uniqueSubserviceIds = [...new Set(subservice_ids.map(String))];

    // Find candidate providers offering ALL requested subservices
    const provRes = await db.query(
      `SELECT ps.provider_id, array_agg(pss.subservice_id::text) AS subs
       FROM provider.provider_services ps
       INNER JOIN provider.provider_service_subservices pss ON pss.provider_service_id = ps.id
       WHERE ps.is_active = TRUE
       GROUP BY ps.provider_id`,
      []
    );

    const capableProviderIds: string[] = [];
    for (const row of provRes.rows) {
      const subs = row.subs || [];
      const handlesAll = uniqueSubserviceIds.every(id => subs.includes(id));
      if (handlesAll) capableProviderIds.push(String(row.provider_id));
    }

    let candidateProviders: any[] = [];
    if (capableProviderIds.length > 0) {
      const cRes = await db.query(
        `SELECT id, user_id FROM provider.providers
         WHERE id::text = ANY($1)
           AND kyc_status = 'verified'
           AND status = 'active'
           AND deleted_at IS NULL`,
        [capableProviderIds]
      );
      candidateProviders = cRes.rows;
    } else {
      const cRes = await db.query(
        `SELECT id, user_id FROM provider.providers
         WHERE kyc_status = 'verified'
           AND status = 'active'
           AND deleted_at IS NULL
         LIMIT 20`
      );
      candidateProviders = cRes.rows;
    }

    if (candidateProviders.length === 0) {
      res.json({ available: false, candidate_count: 0, reason: 'No verified providers available in your service area.' });
      return;
    }

    // Configurable operating hours check from dispatch_settings
    let dispatchSetting: any = null;
    try {
      const sRes = await db.query('SELECT settings FROM provider.dispatch_settings LIMIT 1');
      dispatchSetting = sRes.rows[0]?.settings ?? null;
    } catch (_) {}

    const operatingEndHour = Number(dispatchSetting?.operatingEndHour) || 20;

    for (const item of items) {
      const itemStart = parseBookingStart(item.scheduled_at, item.booking_time);
      const duration = Number(item.duration_minutes) || 60;
      const itemEnd = new Date(itemStart.getTime() + duration * 60 * 1000);

      if (itemEnd.getHours() > operatingEndHour || (itemEnd.getHours() === operatingEndHour && itemEnd.getMinutes() > 0)) {
        res.json({
          available: false,
          candidate_count: 0,
          reason: `Service timeline exceeds daily operating hours (${operatingEndHour}:00). Please select an earlier start time.`
        });
        return;
      }
    }

    let qualifyingProvidersCount = 0;

    for (const provider of candidateProviders) {
      let providerFitsAll = true;

      for (const item of items) {
        const itemStart = parseBookingStart(item.scheduled_at, item.booking_time);
        const duration = Number(item.duration_minutes) || 60;
        const travelMinutes = Number(item.travel_minutes) || 15;
        const buffers = await scheduleEngine.resolveBuffers(item.subservice_id);

        const fit = await scheduleEngine.canBookingFit(
          String(provider.id),
          itemStart,
          duration,
          travelMinutes,
          buffers
        );

        if (!fit.fits) {
          providerFitsAll = false;
          break;
        }
      }

      if (providerFitsAll) {
        qualifyingProvidersCount++;
      }
    }

    if (qualifyingProvidersCount > 0) {
      res.json({ available: true, candidate_count: qualifyingProvidersCount });
    } else {
      res.json({
        available: false,
        candidate_count: 0,
        reason: 'Providers in your area are busy during the requested time window.'
      });
    }
  } catch (error: any) {
    res.status(500).json({ available: false, message: error.message });
  }
};
