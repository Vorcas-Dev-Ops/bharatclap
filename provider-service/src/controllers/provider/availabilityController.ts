import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { ProviderRepository } from '../../repositories/providerRepository';
import { WalletRepository } from '../../repositories/walletRepository';
import { filterConflictingProviders } from '../dispatchController';

// @route   PUT /api/providers/availability
// @access  Private/Provider
export const updateMyAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const userIdStr = String(req.user?.id || req.user?._id);
    
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    if ((status === 'available' || status === 'busy') && provider.kyc_status !== 'verified') {
      res.status(403).json({ message: 'Complete KYC verification before going online.' });
      return;
    }

    const isOnline = status !== 'offline';
    const isBusy = status === 'busy';

    await ProviderRepository.updateAvailability(provider.id, status, isOnline, isBusy);

    res.json({ message: 'Availability updated', status, isOnline });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Release provider (Internal API)
// @route   POST /api/providers/internal/release
// @access  Internal
export const releaseProviderInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { provider_id, booking_id } = req.body;
    const provider = await ProviderRepository.findById(String(provider_id));
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    await ProviderRepository.updateAvailability(provider.id, 'available', true, false);

    // If booking_id is provided, automatically check and process lead fee refund
    if (booking_id) {
      const deductionRes = await db.query(
        `SELECT * FROM provider.wallet_transactions
         WHERE provider_id = $1
           AND type = 'deduction'
           AND reference_id = $2
           AND status = 'success'
         LIMIT 1`,
        [provider.id, String(booking_id)]
      );
      const deductionTx = deductionRes.rows[0];

      if (deductionTx) {
        try {
          await WalletRepository.recordTransaction({
            providerId: provider.id,
            amount: Number(deductionTx.amount),
            type: 'refund',
            referenceType: 'booking_lead_fee_refund',
            referenceId: String(booking_id),
            description: `Auto-refund lead fee for unfulfilled booking #${booking_id}`
          });
        } catch (err: any) {
          console.warn(`[RELEASE] Wallet refund error: ${err.message}`);
        }
      }
    }

    res.json({ message: 'Provider released successfully', provider_id: provider.id });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check if any provider is available for subservice & location
// @route   GET /api/providers/availability/check
// @access  Public
export const checkProviderAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { subservice_id, scheduled_at, booking_time } = req.query as Record<string, string | undefined>;

    if (!subservice_id) {
      res.status(400).json({ available: false, message: 'subservice_id is required' });
      return;
    }

    // Check if any verified active provider offers this subservice
    const provRes = await db.query(
      `SELECT p.id, p.user_id, p.availability_status, p.kyc_status, p.is_busy
       FROM provider.providers p
       INNER JOIN provider.provider_services ps ON ps.provider_id = p.id AND ps.is_active = TRUE
       INNER JOIN provider.provider_service_subservices pss ON pss.provider_service_id = ps.id
       WHERE (pss.subservice_id::text = $1)
         AND p.deleted_at IS NULL
         AND p.status = 'active'
         AND p.kyc_status = 'verified'
       LIMIT 20`,
      [subservice_id]
    );

    let candidates = provRes.rows;

    if (candidates.length === 0) {
      // System fallback: any verified provider
      const fallbackRes = await db.query(
        `SELECT id, user_id, availability_status, kyc_status, is_busy
         FROM provider.providers
         WHERE deleted_at IS NULL
           AND status = 'active'
           AND kyc_status = 'verified'
         LIMIT 10`
      );
      candidates = fallbackRes.rows;
    }

    if (candidates.length === 0) {
      res.json({ available: false });
      return;
    }

    // Filter scheduling conflicts if scheduled_at is provided
    if (scheduled_at) {
      const available = await filterConflictingProviders(candidates, scheduled_at, booking_time);
      res.json({ available: available.length > 0 });
      return;
    }

    res.json({ available: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
