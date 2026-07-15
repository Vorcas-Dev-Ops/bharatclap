import { Request, Response } from 'express';
import { Provider } from '../../models/Provider';
import { ProviderService } from '../../models/ProviderService';
import { saveFileToCloud, deleteFileFromCloud } from '../../utils/fileHelper';
import { emitToUser } from '../../services/socketService';
import { getUsersBatch, sendAdminNotification } from '../../utils/internalApi';
import bcrypt from 'bcryptjs';
import axios from 'axios';

interface ResolvedUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  profile_image?: string;
  status?: string;
}

// @desc    Get all providers
// @route   GET /api/providers
// @access  Private/Admin
export const getProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;

    const [providers, total] = await Promise.all([
      Provider.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Provider.countDocuments({ isDeleted: false })
    ]);

    if (providers.length === 0) { res.json({ data: [], total, page, limit, pages: 0 }); return; }

    const providerIds = providers.map(p => p._id);
    const userIds     = [...new Set(providers.map(p => p.user_id?.toString()).filter(Boolean))];

    // 1 DB query for all ProviderServices (replaces N individual finds)
    const [allServices, users] = await Promise.all([
      ProviderService.find({ provider_id: { $in: providerIds }, isDeleted: false }).lean(),
      getUsersBatch(userIds)
    ]);

    // Group services by provider_id
    const servicesByProvider = new Map<string, any[]>();
    for (const svc of allServices) {
      const key = String(svc.provider_id);
      if (!servicesByProvider.has(key)) servicesByProvider.set(key, []);
      servicesByProvider.get(key)!.push(svc);
    }

    const userMap = new Map<string, ResolvedUser>(users.map((u: any) => [String(u._id), u as ResolvedUser]));

    const providersWithServices = providers.map(provider => {
      const services = servicesByProvider.get(String(provider._id)) || [];
      return {
        ...provider,
        user_id: userMap.get(String(provider.user_id)) ?? provider.user_id,
        services // Not hydrating subservices for list view to prevent huge payloads (SC-3)
      };
    });

    res.json({ data: providersWithServices, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get multiple providers by IDs (Internal API)
// @route   POST /api/providers/batch
// @access  Public (Internal)
export const getProvidersBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({ message: 'Please provide an array of ids' });
      return;
    }
    const providers = await Provider.find({ _id: { $in: ids } }).lean();
    res.json(providers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get providers by user_ids (Internal API)
// @route   POST /api/providers/by-user-ids
// @access  Public (Internal)
export const getProvidersByUserIds = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds)) {
      res.status(400).json({ message: 'Please provide an array of userIds' });
      return;
    }
    const providers = await Provider.find({ user_id: { $in: userIds } }).lean();
    res.json(providers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get provider count stats (Internal API)
// @route   GET /api/providers/stats
// @access  Public (Internal)
export const getProviderStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await Provider.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$kyc_status', count: { $sum: 1 } } }
    ]);

    let total = 0, pending = 0, verified = 0;
    for (const stat of stats) {
      total += stat.count;
      if (stat._id === 'pending') pending = stat.count;
      else if (stat._id === 'verified') verified = stat.count;
    }

    res.json({ total, pending, verified });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single provider by ID
// @route   GET /api/providers/:id
// @access  Private/Admin
export const getProviderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findById(req.params.id).lean();
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const users = await getUsersBatch([provider.user_id.toString()]);
    const user = users.length ? users[0] : null;

    res.json({
      ...provider,
      user_id: user ?? provider.user_id
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a provider profile
// @route   POST /api/providers
// @access  Private/Admin
export const createProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      name, email, phone, password, 
      profile_image, availability_status, 
      aadhar_id, bank_details, verification_docs,
      services 
    } = req.body;

    let user_id = req.body.user_id;

    if (!user_id && email && password) {
      try {
        const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
        const registerRes = await axios.post(`${AUTH_URL}/api/users/register`, {
          name, email, phone, password, role: 'provider', profile_image
        });
        user_id = registerRes.data?._id;
      } catch (err: any) {
        res.status(400).json({ message: err.response?.data?.message || 'Failed to create user account' });
        return;
      }
    }

    if (!user_id) {
      res.status(400).json({ message: 'User ID or account credentials required' });
      return;
    }

    const alreadyExists = await Provider.findOne({ user_id });
    if (alreadyExists) {
      res.status(400).json({ message: 'Provider profile already exists for this user' });
      return;
    }

    let secureAadhar = {};
    if (aadhar_id) {
      const salt = await bcrypt.genSalt(10);
      secureAadhar = {
        aadhar_last4: aadhar_id.slice(-4),
        aadhar_hash: await bcrypt.hash(aadhar_id, salt)
      };
    }

    let secureBank = { ...bank_details };
    if (bank_details?.account_number) {
      const salt = await bcrypt.genSalt(10);
      secureBank.account_number_last4 = bank_details.account_number.slice(-4);
      secureBank.account_number_hash = await bcrypt.hash(bank_details.account_number, salt);
      delete secureBank.account_number;
    }

    const provider = await Provider.create({
      user_id,
      availability_status: availability_status || 'offline',
      is_verified: false,
      ...secureAadhar,
      bank_details: secureBank,
    });

    if (verification_docs?.id_proof_url) {
      saveFileToCloud(verification_docs.id_proof_url, 'verification/pending')
        .then(async (idProofRes: any) => {
          provider.verification_docs = typeof idProofRes === 'object' ? {
            id_proof_url: idProofRes.secure_url,
            public_id: idProofRes.public_id,
            resource_type: idProofRes.resource_type,
          } : {
            id_proof_url: idProofRes,
          };
          await provider.save();
        })
        .catch(console.error);
    }

    let createdServices: any[] = [];
    if (Array.isArray(services)) {
      createdServices = await Promise.all(
        services.map(async (serviceData) => {
          const svc = await ProviderService.create({
            provider_id: provider._id,
            ...serviceData
          });
          return svc.toJSON ? svc.toJSON() : svc;
        })
      );
    }

    const users = await getUsersBatch([provider.user_id.toString()]);
    const user = users.length ? users[0] : null;
    const allServices = createdServices;

    // Send admin notification
    await sendAdminNotification(
      'New Provider Registration',
      `A new provider (${user?.name || email}) has registered and is pending verification.`,
      'system_alert',
      { provider_id: provider._id }
    );

    res.status(201).json({
      ...provider.toObject(),
      user_id: user ?? provider.user_id,
      services: allServices
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a provider profile
// @route   PUT /api/providers/:id
// @access  Private/Admin
export const updateProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { 
      availability_status, 
      is_verified, 
      status, 
      aadhar_id, 
      bank_details, 
      verification_docs,
      kyc_rejection_reason 
    } = req.body;

    provider.availability_status = availability_status ?? provider.availability_status;
    provider.is_verified         = is_verified         ?? provider.is_verified;
    provider.kyc_status          = status              ?? provider.kyc_status;
    
    if (status === 'verified') {
      provider.is_verified = true;
      provider.verified_at = new Date();
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      provider.verification_docs_expiry = expiryDate;
      provider.kyc_rejection_reason = undefined;
      
      await ProviderService.updateMany(
        { provider_id: provider._id },
        { documents_expiry: expiryDate }
      );
    }

    if (status === 'rejected') {
      provider.is_verified = false;
      provider.kyc_rejection_reason = kyc_rejection_reason || 'Documents did not meet our verification standards.';
    }
    
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
      if (provider.verification_docs?.public_id) {
        await deleteFileFromCloud(provider.verification_docs.public_id, provider.verification_docs.resource_type);
      } else if (provider.verification_docs?.id_proof_url) {
        await deleteFileFromCloud(provider.verification_docs.id_proof_url);
      }

      if (verification_docs?.id_proof_url) {
        saveFileToCloud(verification_docs.id_proof_url, 'verification/pending')
          .then(async (idProofRes: any) => {
            provider.verification_docs = typeof idProofRes === 'object' ? {
              id_proof_url: idProofRes.secure_url,
              public_id: idProofRes.public_id,
              resource_type: idProofRes.resource_type,
            } : {
              id_proof_url: idProofRes,
            };
            await provider.save();
          })
          .catch(console.error);
      } else {
        provider.verification_docs = { id_proof_url: '' };
      }
      if (status !== 'verified') {
        provider.kyc_status = 'pending';
        provider.is_verified = false;
      }
    }

    const updated = await provider.save();
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

// @desc    Delete a provider profile
// @route   DELETE /api/providers/:id
// @access  Private/Admin
export const deleteProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findById(req.params.id);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }
    
    provider.isDeleted = true;
    provider.availability_status = 'offline';
    await provider.save();

    await ProviderService.updateMany(
      { provider_id: provider._id },
      { isDeleted: true, is_active: false }
    );
    
    res.json({ message: 'Provider profile and associated services removed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const socketEmitInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, event, data } = req.body;
    emitToUser(userId, event, data);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getActiveSubservices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { location_ids } = req.body;
    if (!location_ids || !Array.isArray(location_ids)) {
      res.status(400).json({ message: 'location_ids must be an array' });
      return;
    }
    
    const availableSubServiceIds = await ProviderService.distinct('subservice_ids', {
      location_ids: { $in: location_ids },
      isDeleted: false,
      is_active: true
    });
    
    res.status(200).json({ subservice_ids: availableSubServiceIds });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
