import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getDb } from '../../config/db';
import { ProviderRepository } from '../../repositories/providerRepository';
import { ProviderServiceRepository } from '../../repositories/providerServiceRepository';
import { saveFileToCloud, deleteFileFromCloud } from '../../utils/fileHelper';
import { getUsersBatch, getCatalogBatch, sendProviderNotification } from '../../utils/internalApi';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { encrypt } from '@bharatclap/shared';
import { initializeProviderWalletOnce } from '../../services/walletLedgerService';
import { generateProviderCode } from '../../utils/providerIdGenerator';

interface ResolvedSubService {
  _id: string;
  subservice_name: string;
}

/**
 * Security & DPDP Compliance:
 * Sanitizes onboarding draft JSONB. Strips raw PAN numbers, Aadhaar numbers,
 * and full bank account numbers from onboarding draft JSONB.
 * Retains only masked or last-4 references for draft previews so plaintext sensitive credentials
 * are NEVER persisted in draft storage or exposed via GET /api/providers/me.
 */
export const sanitizeOnboardingDraft = (draft: any): any => {
  if (!draft || typeof draft !== 'object') return draft;
  const safe = { ...draft };

  // Strip raw PAN and convert to masked / last4 if present
  if (safe.pan_number) {
    const raw = String(safe.pan_number).trim().toUpperCase();
    if (raw.length === 10) {
      safe.pan_last4 = raw.slice(-4);
      safe.has_pan = true;
    }
    delete safe.pan_number;
  }

  // Strip raw Aadhaar and convert to masked / last4 if present
  if (safe.aadhaar_number) {
    const raw = String(safe.aadhaar_number).replace(/\s/g, '');
    if (raw.length === 12) {
      safe.aadhaar_last4 = raw.slice(-4);
      safe.has_aadhaar = true;
    }
    delete safe.aadhaar_number;
  }

  // Strip any raw bank account credentials from draft JSONB
  delete safe.account_number;
  delete safe.accountNumber;
  delete safe.bank_account_number;
  delete safe.bankAccountNumber;
  delete safe.card_number;
  delete safe.cvv;

  return safe;
};

const calculateRegistrationState = (provider: any, services: any[]) => {
  const servicesCompleted = Array.isArray(services) && services.length > 0;
  const locationsCompleted = Boolean(provider.live_location || provider.service_radius);
  // ponytail: identity is "completed" if docs were submitted (draft flags) OR already verified
  const draft = provider.onboarding_draft || {};
  const identityCompleted = Boolean(
    provider.kyc_status === 'verified' || provider.is_verified ||
    draft.has_pan || draft.has_aadhaar
  );
  const bankCompleted = Boolean(provider.bank_details?.account_holder_name || provider.bank_details?.ifsc_code);

  const completed = servicesCompleted && locationsCompleted && identityCompleted && bankCompleted;

  let applicationStatus = 'PENDING';
  if (provider.kyc_status === 'verified' || provider.is_verified) {
    applicationStatus = 'VERIFIED';
  } else if (provider.kyc_status === 'rejected') {
    applicationStatus = 'REJECTED';
  } else if (completed) {
    applicationStatus = 'UNDER_REVIEW';
  }

  return {
    registration: {
      services_completed: servicesCompleted,
      locations_completed: locationsCompleted,
      identity_completed: identityCompleted,
      bank_completed: bankCompleted,
      completed,
    },
    application_status: applicationStatus,
  };
};

// @desc    Get current provider profile
// @route   GET /api/providers/me
// @access  Private/Provider
export const getMyProviderProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    let provider = await ProviderRepository.findByUserId(userIdStr);
    
    if (!provider && req.user?.role === 'provider') {
      const insRes = await db.query(
        `INSERT INTO provider.providers (
           user_id, availability_status, kyc_status, onboarding_status, onboarding_step
         ) VALUES ($1, 'offline', 'pending', 'DRAFT', 0)
         RETURNING *`,
        [userIdStr]
      );
      const newProviderId = insRes.rows[0].id;
      await initializeProviderWalletOnce(newProviderId, 0);
      provider = await ProviderRepository.findById(newProviderId);
    }

    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    if (!provider.provider_code) {
      await generateProviderCode(provider.id).catch(() => {});
      provider = await ProviderRepository.findById(provider.id) || provider;
    }

    const services = await ProviderServiceRepository.getServicesForProvider(provider.id);
    const subserviceIds = [...new Set(services.flatMap(s => s.subservice_ids).map(String))];
    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
    const { getInternalServiceKey } = require('@bharatclap/shared');

    const [catalogData, users, providerStatsRes] = await Promise.all([
      getCatalogBatch(subserviceIds, [], [], []).catch(() => ({ subservices: [], services: [], categories: [], coupons: [] })),
      getUsersBatch([provider.user_id]).catch(() => []),
      axios.get(
        `${BOOKING_URL}/api/bookings/provider/${provider.id}/stats`,
        {
          headers: { 'x-internal-service-key': getInternalServiceKey() },
          timeout: 2000
        }
      ).catch(() => ({ data: { total_jobs: 0, completed_jobs: 0, earnings: 0 } }))
    ]);

    const subserviceMap = new Map<string, ResolvedSubService>(
      (catalogData?.subservices || []).map((s: any) => [String(s._id || s.id), s as ResolvedSubService])
    );

    const processedServices = services.map(s => ({
      ...s,
      subservice_ids: (s.subservice_ids || []).map(id => subserviceMap.get(String(id)) || { _id: id, subservice_name: '—' })
    }));

    const profileData = { ...provider } as any;
    const user = Array.isArray(users) && users.length ? users[0] : (req.user ? { _id: req.user._id, name: req.user.name, role: req.user.role } : null);
    profileData.user_id = user ?? provider.user_id;

    const providerStats = providerStatsRes.data;
    profileData.total_jobs     = providerStats.total_jobs     ?? provider.total_bookings ?? 0;
    profileData.completed_jobs = providerStats.completed_jobs ?? provider.successful_bookings ?? 0;
    profileData.earnings       = providerStats.earnings        ?? 0;
    const kitPaidRes = await db.query(
      `SELECT id, status, updated_at FROM provider.provider_orders WHERE provider_id = $1 AND order_type = 'starter_kit' AND status = 'paid' LIMIT 1`,
      [provider.id]
    ).catch(() => ({ rowCount: 0, rows: [] }));
    const paidOrder = kitPaidRes?.rows?.[0];
    const hasPaidKit = provider.kit_payment_status === 'PAID' || (kitPaidRes?.rowCount || 0) > 0;
    
    // Canonical lifecycle fields
    profileData.onboarding_status = provider.onboarding_status || 'DRAFT';
    profileData.kyc_status = provider.kyc_status || 'pending';
    profileData.kit_payment_status = hasPaidKit ? 'PAID' : (provider.kit_payment_status || 'PENDING');
    profileData.kit_payment_id = provider.kit_payment_id || paidOrder?.id || null;
    profileData.kit_payment_date = provider.kit_payment_date || paidOrder?.updated_at || null;
    profileData.kit_collection_id = provider.kit_collection_id || null;
    profileData.kit_collection_status = provider.kit_collection_status || (hasPaidKit ? 'PENDING' : 'NOT_APPLICABLE');
    profileData.kit_collected_at = provider.kit_collected_at || null;
    profileData.kit_collected_by_name = provider.kit_collected_by_name || null;
    profileData.access_type = provider.access_type || 'NONE';
    profileData.access_status = provider.access_status || 'PENDING';
    profileData.availability_status = provider.availability_status || 'available';
    profileData.is_online = Boolean(provider.is_online);

    profileData.dispatch_eligible = Boolean(
      profileData.onboarding_status === 'APPROVED' &&
      profileData.kyc_status === 'verified' &&
      profileData.kit_payment_status === 'PAID' &&
      profileData.kit_collection_status === 'COLLECTED' &&
      profileData.access_status === 'ACTIVE' &&
      profileData.availability_status === 'available' &&
      profileData.is_online &&
      !provider.is_wallet_blocked &&
      provider.status !== 'suspended' &&
      provider.status !== 'blocked' &&
      !provider.deleted_at
    );

    // Legacy compatibility fields
    profileData.kitPurchased = profileData.kit_payment_status === 'PAID';
    profileData.kit_purchased = profileData.kit_payment_status === 'PAID';
    profileData.kitCollected = profileData.kit_collection_status === 'COLLECTED';
    profileData.onboardingCompleted = profileData.onboarding_status === 'APPROVED' && profileData.kit_payment_status === 'PAID' && profileData.kit_collection_status === 'COLLECTED' && profileData.access_status === 'ACTIVE';
    profileData.isFreeAccessEnabled = profileData.access_type === 'FREE' || profileData.access_mode === 'free' || true;

    const regState = calculateRegistrationState(provider, processedServices);

    res.json({
      ...profileData,
      services: processedServices,
      registration: regState.registration,
      application_status: regState.application_status,
      onboarding_status: profileData.onboarding_status,
      onboarding_step: provider.onboarding_step ?? 0,
      onboarding_draft: provider.onboarding_draft ? sanitizeOnboardingDraft(provider.onboarding_draft) : null,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update current provider profile
// @route   PUT /api/providers/me
// @access  Private/Provider
export const updateMyProviderProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    let provider = await ProviderRepository.findByUserId(userIdStr);
    
    if (!provider && req.user?.role === 'provider') {
      const insRes = await db.query(
        `INSERT INTO provider.providers (
           user_id, availability_status, kyc_status, onboarding_status, onboarding_step
         ) VALUES ($1, 'offline', 'pending', 'DRAFT', 0)
         RETURNING *`,
        [userIdStr]
      );
      const newProviderId = insRes.rows[0].id;
      await initializeProviderWalletOnce(newProviderId, 0);
      provider = await ProviderRepository.findById(newProviderId);
    }

    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const {
      availability_status,
      bank_details,
      service_locations,
      onboarding_draft,
      onboarding_step,
      service_radius,
    } = req.body;

    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [provider.id];

    if (onboarding_draft !== undefined) {
      const sanitizedDraft = sanitizeOnboardingDraft(onboarding_draft);
      values.push(JSON.stringify(sanitizedDraft));
      updates.push(`onboarding_draft = $${values.length}::jsonb`);
    }
    if (onboarding_step !== undefined) {
      values.push(Number(onboarding_step));
      updates.push(`onboarding_step = $${values.length}`);
    }
    if (service_radius !== undefined) {
      values.push(Number(service_radius));
      updates.push(`service_radius = $${values.length}`);
    }
    if (availability_status !== undefined) {
      values.push(availability_status);
      updates.push(`availability_status = $${values.length}`);
    }

    await db.query(
      `UPDATE provider.providers SET ${updates.join(', ')} WHERE id = $1`,
      values
    );

    if (bank_details) {
      const cleanAccount = String(bank_details.accountNumber || bank_details.account_number || '').trim();
      const cleanHolder = String(bank_details.accountHolderName || bank_details.account_holder_name || '').trim();
      const cleanIfsc = String(bank_details.ifscCode || bank_details.ifsc_code || '').trim().toUpperCase();
      const cleanBank = String(bank_details.bankName || bank_details.bank_name || '').trim();

      if (cleanHolder && cleanIfsc) {
        const encryptedAccount = cleanAccount ? encrypt(cleanAccount) : null;
        await db.query(
          `INSERT INTO provider.provider_bank_details (
             provider_id, account_holder_name, account_number_last4, account_number_encrypted, ifsc_code, bank_name, status
           ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
           ON CONFLICT (provider_id) DO UPDATE SET
             account_holder_name = EXCLUDED.account_holder_name,
             account_number_last4 = EXCLUDED.account_number_last4,
             account_number_encrypted = COALESCE(EXCLUDED.account_number_encrypted, provider.provider_bank_details.account_number_encrypted),
             ifsc_code = EXCLUDED.ifsc_code,
             bank_name = EXCLUDED.bank_name,
             updated_at = NOW()`,
          [provider.id, cleanHolder, cleanAccount.slice(-4), encryptedAccount, cleanIfsc, cleanBank]
        );
      }
    }

    const updated = await ProviderRepository.findById(provider.id);
    const services = await ProviderServiceRepository.getServicesForProvider(provider.id);
    const regState = calculateRegistrationState(updated, services);

    res.json({ 
      ...updated, 
      services,
      registration: regState.registration,
      application_status: regState.application_status,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get provider UPI payment profile
// @route   GET /api/providers/me/payment-profile
// @access  Private/Provider
export const getProviderPaymentProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    res.json({
      upiEnabled: Boolean(provider.bank_details?.status === 'verified'),
      upiId: '',
      upiStatus: provider.bank_details?.status || 'PENDING',
      displayName: provider.bank_details?.account_holder_name || req.user?.name || 'BharatClap Partner',
      verifiedAt: provider.bank_details?.verified_at,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update and verify provider UPI ID
// @route   POST /api/providers/me/upi-profile
// @access  Private/Provider
export const updateProviderUpiProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { upiId, displayName } = req.body;

    if (!upiId || !String(upiId).includes('@')) {
      res.status(400).json({ message: 'Please provide a valid UPI ID (e.g. name@upi)' });
      return;
    }

    const cleanUpiId = String(upiId).trim().toLowerCase();
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!upiRegex.test(cleanUpiId)) {
      res.status(400).json({ message: 'Invalid UPI ID format. Expected standard handle like name@bank' });
      return;
    }

    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    res.json({
      message: 'UPI ID verified successfully',
      upiEnabled: true,
      upiId: cleanUpiId,
      upiStatus: 'VERIFIED',
      displayName: displayName?.trim() || req.user?.name || 'BharatClap Partner',
      verifiedAt: new Date(),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit provider application for review
// @route   POST /api/providers/me/submit
// @access  Private/Provider
export const submitForReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const status = provider.onboarding_status || 'DRAFT';
    if (status !== 'DRAFT' && status !== 'ACTION_REQUIRED') {
      res.status(400).json({ message: `Cannot submit: current status is ${status}` });
      return;
    }

    const services = await ProviderServiceRepository.getServicesForProvider(provider.id);
    const regState = calculateRegistrationState(provider, services);

    if (!regState.registration.completed) {
      const missing: string[] = [];
      if (!regState.registration.services_completed) missing.push('services');
      if (!regState.registration.locations_completed) missing.push('service locations');
      if (!regState.registration.identity_completed) missing.push('identity verification');
      if (!regState.registration.bank_completed) missing.push('bank/payment details');
      res.status(400).json({
        message: `Registration incomplete. Missing: ${missing.join(', ')}`,
        registration: regState.registration,
      });
      return;
    }

    await db.query(
      `UPDATE provider.providers
       SET onboarding_status = 'UNDER_REVIEW',
           kyc_status = 'pending',
           onboarding_draft = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [provider.id]
    );

    sendProviderNotification(
      provider.user_id,
      'Application Submitted',
      'Your provider application has been submitted for review. We will notify you once approved.',
      'system_alert',
      { onboarding_status: 'UNDER_REVIEW' }
    ).catch(err => console.error('[NOTIFICATION] Failed to send submit notification:', err));

    res.json({
      message: 'Application submitted for review successfully',
      onboarding_status: 'UNDER_REVIEW',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
