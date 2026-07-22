import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { ProviderService } from '../../models/ProviderService';
import { WalletTransaction } from '../../models/WalletTransaction';
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
    
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    if ((status === 'available' || status === 'busy') && provider.kyc_status !== 'verified') {
      res.status(403).json({ message: 'Complete KYC verification before going online.' });
      return;
    }

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

    provider.availability_status = status;
    provider.isOnline = update.isOnline;
    provider.isBusy = update.isBusy;
    await provider.save();

    res.json({ message: 'Availability updated', status: provider.availability_status, isOnline: provider.isOnline });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Release provider (Internal API)
// @route   POST /api/providers/internal/release
// @access  Internal
export const releaseProviderInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider_id, booking_id } = req.body;
    const provider = await Provider.findById(provider_id);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    provider.availability_status = 'available';
    provider.isBusy = false;
    await provider.save();

    // If booking_id is provided, automatically check and process lead fee refund
    if (booking_id) {
      // Find the deduction transaction
      const deductionTx = await WalletTransaction.findOne({
        provider_id: provider._id,
        type: 'deduction',
        referenceId: String(booking_id),
        status: 'success'
      });

      if (deductionTx) {
        // Check if already refunded
        const alreadyRefunded = await WalletTransaction.findOne({
          type: 'refund',
          referenceId: String(booking_id)
        });

        if (!alreadyRefunded) {
          provider.walletBalance += deductionTx.amount;
          await provider.save();

          await WalletTransaction.create({
            provider_id: provider._id,
            type: 'refund',
            amount: deductionTx.amount,
            balanceAfter: provider.walletBalance - provider.reservedBalance,
            referenceId: String(booking_id),
            description: `Auto-refund: Lead fee refunded due to booking cancellation`,
            status: 'success'
          });
          console.log(`[REFUND] Auto-refunded ₹${deductionTx.amount} to provider ${provider._id} for cancelled booking ${booking_id}`);
        }
      }
    }

    res.json({ success: true });
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

    console.log(`[AVAILABILITY CHECK] Start check for subservice: ${subservice_id}, location_id: ${location_id}`);

    // 1. Find ProviderService records offering this subservice
    const providerServices = await ProviderService.find({
      subservice_ids: new mongoose.Types.ObjectId(subservice_id),
      is_active: true,
      isDeleted: false
    }).select('provider_id').lean();

    const providerIds = providerServices.map((ps: any) => ps.provider_id);
    console.log(`[AVAILABILITY CHECK] Found ${providerIds.length} provider(s) offering this subservice: ${providerIds.join(', ')}`);
    if (providerIds.length === 0) {
      console.log(`[AVAILABILITY CHECK] Failed at Step 1: No ProviderService found for subservice ${subservice_id}`);
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
    let resolvedPincode: string | null = null;

    if (location_id && location_id !== 'custom' && mongoose.Types.ObjectId.isValid(location_id)) {
      if (addresses.length > 0) {
        const address = addresses[0] as any;
        console.log(`[AVAILABILITY CHECK] Resolved user address from DB. City: ${address.city}, Pincode: ${address.pincode}`);
        if (address.coordinates?.coordinates) {
          coordinates = address.coordinates.coordinates;
        } else if (address.latitude != null && address.longitude != null) {
          coordinates = [address.longitude, address.latitude];
        }
        if (address.city) resolvedLocationText = address.city;
        if (address.pincode) resolvedPincode = address.pincode;
      } else {
        const locs = await axios.post(`${process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001'}/api/locations/batch`, { ids: [location_id] }, {
          headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
        }).catch(() => ({ data: [] }));
        if (locs.data && locs.data.length > 0) {
          const loc = locs.data[0];
          console.log(`[AVAILABILITY CHECK] Resolved location doc from DB. Name: ${loc.name}, Pincode: ${loc.pincode}`);
          cityLocationId = loc._id;
          resolvedLocationText = loc.name;
          if (loc.pincode) resolvedPincode = loc.pincode;
          if (loc.coordinates?.coordinates) coordinates = loc.coordinates.coordinates;
        }
      }
    }

    if (!_locationsCache || Date.now() > _locationsCacheExpiry) {
      const allLocs = await axios.get(`${process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001'}/api/locations`).catch(() => ({ data: [] }));
      _locationsCache = allLocs.data;
      _locationsCacheExpiry = Date.now() + 5 * 60 * 1000;
    }
    const locationsList = _locationsCache;

    if (!cityLocationId && resolvedLocationText && Array.isArray(locationsList)) {
      const loc = locationsList.find((l: any) => 
        l.name.toLowerCase() === resolvedLocationText!.toLowerCase() && l.status === 'active'
      );
      if (loc) {
        cityLocationId = loc._id;
        console.log(`[AVAILABILITY CHECK] Found cityLocationId by name: ${loc.name} -> ${loc._id}`);
      }
    }

    // ── Candidate lookup ─────────────────────────────────────────────────────
    
    // 2d. Fallback: check ProviderService.location_ids directly.
    if (Array.isArray(locationsList)) {
      const locationIdsToCheck: mongoose.Types.ObjectId[] = [];

      const matchingLocs = locationsList.filter((l: any) => {
        if (l.status !== 'active') return false;
        if (cityLocationId && String(l._id) === String(cityLocationId)) return true;
        if (resolvedLocationText && l.name?.toLowerCase() === resolvedLocationText.toLowerCase()) return true;
        if (resolvedPincode && l.pincode === resolvedPincode) return true;
        return false;
      });

      matchingLocs.forEach((l: any) => locationIdsToCheck.push(new mongoose.Types.ObjectId(String(l._id))));
      const matchingLocIds = new Set(matchingLocs.map((l: any) => String(l._id)));
      
      const childLocs = locationsList.filter((l: any) => l.status === 'active' && matchingLocIds.has(String(l.parent_id)));
      childLocs.forEach((l: any) => locationIdsToCheck.push(new mongoose.Types.ObjectId(String(l._id))));

      const childLocIds = new Set(childLocs.map((l: any) => String(l._id)));
      const grandchildLocs = locationsList.filter((l: any) => l.status === 'active' && childLocIds.has(String(l.parent_id)));
      grandchildLocs.forEach((l: any) => locationIdsToCheck.push(new mongoose.Types.ObjectId(String(l._id))));

      console.log(`[AVAILABILITY CHECK] Total location IDs to check against ProviderService: ${locationIdsToCheck.length}`);

      if (locationIdsToCheck.length > 0) {
        const psWithLocation = await ProviderService.find({
          subservice_ids: new mongoose.Types.ObjectId(subservice_id),
          location_ids: { $in: locationIdsToCheck },
          is_active: true,
          isDeleted: false
        }).select('provider_id').lean();

        console.log(`[AVAILABILITY CHECK] ProviderService records matching these locations: ${psWithLocation.length}`);

        if (psWithLocation.length > 0) {
          const psProviderIds = psWithLocation.map((ps: any) => ps.provider_id);
          const verifiedProvider = await Provider.findOne({
            _id: { $in: psProviderIds },
            is_verified: true,
            kyc_status: 'verified',
            isDeleted: false
          }).lean();
          
          if (verifiedProvider) {
             console.log(`[AVAILABILITY CHECK] SUCCESS! Found verified provider: ${verifiedProvider._id}`);
            res.json({ available: true });
            return;
          } else {
             console.log(`[AVAILABILITY CHECK] FAILED: Found provider service, but Provider documents for IDs [${psProviderIds.join(',')}] are NOT verified (is_verified: true, kyc_status: 'verified')`);
          }
        }
      }
    }

    console.log(`[AVAILABILITY CHECK] Exhausted all checks. Returning available: false.`);
    res.json({ available: false });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
