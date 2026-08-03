import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { ProviderService } from '../../models/ProviderService';
import { saveFileToCloud, deleteFileFromCloud } from '../../utils/fileHelper';
import { getUsersBatch, getCatalogBatch, sendProviderNotification } from '../../utils/internalApi';
import bcrypt from 'bcryptjs';
import axios from 'axios';

interface ResolvedSubService {
  _id: string;
  subservice_name: string;
}

import { initializeProviderWalletOnce } from '../../services/walletLedgerService';
import { generateProviderCode } from '../../utils/providerIdGenerator';

// @desc    Get current provider profile
// @route   GET /api/providers/me
// @access  Private/Provider
export const getMyProviderProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let provider = await Provider.findOne({ user_id: req.user?._id }).lean();
    
    if (!provider && req.user?.role === 'provider') {
      const newProvider = await Provider.create({
        user_id: req.user._id,
        availability_status: 'offline',
        kyc_status: 'pending',
        is_verified: false,
      });
      await initializeProviderWalletOnce(newProvider._id, 0);
      provider = await Provider.findById(newProvider._id).lean();
    }

    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    if (!provider.provider_code) {
      await generateProviderCode(provider._id).catch(() => {});
      provider = await Provider.findById(provider._id).lean() || provider;
    }

    const services = await ProviderService.find({ 
      provider_id: provider._id, 
      isDeleted: false 
    }).lean();

    const subserviceIds = [...new Set(services.flatMap((s: any) => s.subservice_ids).map(String))];
    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';

    // Parallelize the three independent I/O operations — no data dependency between them
    const [catalogData, users, providerStatsRes] = await Promise.all([
      getCatalogBatch(subserviceIds, [], [], []),
      getUsersBatch([provider.user_id.toString()]),
      axios.get(
        `${BOOKING_URL}/api/bookings/provider/${provider._id}/stats`,
        { headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' } }
      ).catch(() => ({ data: { total_jobs: 0, completed_jobs: 0, earnings: 0 } }))
    ]);

    const subserviceMap = new Map<string, ResolvedSubService>(catalogData.subservices.map((s: any) => [String(s._id), s as ResolvedSubService]));

    let processedServices = services.map((s: any) => ({
      ...s,
      subservice_ids: s.subservice_ids.map((id: any) => subserviceMap.get(String(id)) || { _id: id, subservice_name: '—' })
    }));

    const profileData = { ...provider } as any;
    const user = users.length ? users[0] : null;
    profileData.user_id = user ?? provider.user_id;

    const providerStats = providerStatsRes.data;
    profileData.total_jobs     = providerStats.total_jobs     ?? 0;
    profileData.completed_jobs = providerStats.completed_jobs ?? 0;
    profileData.earnings       = providerStats.earnings        ?? 0;
    profileData.overall_rating = 4.8;

    if (provider.kyc_status !== 'pending') {
       if (profileData.verification_docs) {
          profileData.verification_docs.id_proof_url = '';
       }
       processedServices = processedServices.map((service: any) => {
         return {
           ...service,
           documents: service.documents?.map((doc: any) => ({ ...doc, file_url: '' })) || []
         };
       });
    }

    res.json({
      ...profileData,
      services: processedServices
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
    let provider = await Provider.findOne({ user_id: req.user?._id });
    
    if (!provider && req.user?.role === 'provider') {
      provider = await Provider.create({
        user_id: req.user._id,
        availability_status: 'offline',
        kyc_status: 'pending',
        is_verified: false,
      });
      await initializeProviderWalletOnce(provider._id, 0);
    }

    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const { availability_status, aadhar_id, bank_details, verification_docs, business_name, experience, category, service_areas, address } = req.body;

    provider.availability_status = availability_status ?? provider.availability_status;
    if (business_name !== undefined) (provider as any).business_name = business_name;
    if (experience !== undefined) (provider as any).experience = experience;
    if (category !== undefined) (provider as any).category = category;
    if (service_areas !== undefined) (provider as any).service_areas = service_areas;
    if (address !== undefined) (provider as any).address = address;
    if (aadhar_id !== undefined) {
      const salt = await bcrypt.genSalt(10);
      provider.aadhar_last4 = aadhar_id.slice(-4);
      provider.aadhar_hash = await bcrypt.hash(aadhar_id, salt);
    }
    
    if (bank_details !== undefined) {
      const secureBank = { ...bank_details };
      if (bank_details.account_number) {
        const salt = await bcrypt.genSalt(10);
        secureBank.account_number_last4 = bank_details.account_number.slice(-4);
        secureBank.account_number_hash = await bcrypt.hash(bank_details.account_number, salt);
        delete (secureBank as any).account_number;
      }
      provider.bank_details = secureBank as any;
    }
    
    if (verification_docs !== undefined) {
      if (provider.kyc_status === 'verified') {
        res.status(403).json({ message: 'Verified documents cannot be modified. Contact support for updates.' });
        return;
      }

      if (provider.verification_docs?.public_id) {
        await deleteFileFromCloud(provider.verification_docs.public_id, provider.verification_docs.resource_type);
      } else if (provider.verification_docs?.id_proof_url) {
        await deleteFileFromCloud(provider.verification_docs.id_proof_url);
      }

      const idProofRes = verification_docs?.id_proof_url ? await saveFileToCloud(verification_docs.id_proof_url, 'verification/pending') : '';

      provider.verification_docs = typeof idProofRes === 'object' ? {
        id_proof_url: idProofRes.secure_url,
        public_id: idProofRes.public_id,
        resource_type: idProofRes.resource_type,
      } : {
        id_proof_url: idProofRes,
      };
      
      provider.kyc_status = 'pending';
      provider.is_verified = false;
    }

    const updated = await provider.save();

    if (provider.user_id) {
      sendProviderNotification(
        provider.user_id.toString(),
        'Profile Updated',
        'Your provider profile details have been updated successfully.',
        'system_alert',
        { provider_id: provider._id }
      ).catch(err => console.error('[NOTIFICATION] Failed to send profile updated notification:', err));
    }

    const users = await getUsersBatch([provider.user_id.toString()]);
    const user = users.length ? users[0] : null;
    
    const services = await ProviderService.find({ provider_id: provider._id, isDeleted: false }).lean();
    res.json({ 
      ...updated.toObject(), 
      user_id: user ?? provider.user_id,
      services 
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
