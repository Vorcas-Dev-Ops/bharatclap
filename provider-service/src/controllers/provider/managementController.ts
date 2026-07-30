import { Request, Response } from 'express';
import { Provider } from '../../models/Provider';
import { ProviderService } from '../../models/ProviderService';
import { saveFileToCloud, deleteFileFromCloud } from '../../utils/fileHelper';
import { emitToUser } from '../../services/socketService';
import { getUsersBatch, sendAdminNotification, checkActiveBookingByProvider, sendProviderNotification } from '../../utils/internalApi';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import mongoose from 'mongoose';
import { JobRequest } from '../../models/JobRequest';
import { ProviderOrder } from '../../models/ProviderOrder';
import { SubscriptionPolicy } from '../../models/SubscriptionPolicy';
import { SubscriptionAuditLog } from '../../models/SubscriptionAuditLog';
import { initializeProviderWalletOnce } from '../../services/walletLedgerService';

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
    const status = req.query.status as string;
    const search = req.query.search as string;

    const filter: any = { isDeleted: { $ne: true } };
    if (status === 'available') {
      filter.availability_status = 'available';
      filter.isBusy = { $ne: true };
    } else if (status === 'busy') {
      filter.isBusy = true;
    } else if (status === 'offline') {
      filter.availability_status = 'offline';
    } else if (status && status !== 'all') {
      filter.kyc_status = status;
    }

    const internalHeaders = {
      ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || ''
    };

    const searchTerm = typeof search === 'string' && search.trim() !== '' && search !== 'undefined' && search !== 'null' ? search.trim() : '';
    if (searchTerm) {
      try {
        const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
        const searchRes = await axios.get(`${AUTH_URL}/api/users?search=${encodeURIComponent(searchTerm)}&limit=1000`, {
          headers: internalHeaders
        });
        const matchingUsers = searchRes.data?.data || [];
        const userFilterIds = matchingUsers.map((u: any) => u._id.toString());
        filter.user_id = { $in: userFilterIds };
      } catch (err: any) {
        console.error('[PROVIDER SEARCH] Failed to fetch users matching keyword:', err.message);
      }
    }

    // Auto-sync any registered provider users from auth-service who don't have a Provider document yet
    try {
      const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
      const providerUsersRes = await axios.get(`${AUTH_URL}/api/users?role=provider&limit=1000`, {
        headers: internalHeaders
      });
      const providerUsers = providerUsersRes.data?.data || [];
      if (providerUsers.length > 0) {
        const existingProviderUserIds = new Set(
          (await Provider.find({ user_id: { $in: providerUsers.map((u: any) => u._id) } }).select('user_id').lean())
            .map((p: any) => String(p.user_id))
        );
        const missingUsers = providerUsers.filter((u: any) => !existingProviderUserIds.has(String(u._id)));
        if (missingUsers.length > 0) {
          await Provider.insertMany(
            missingUsers.map((u: any) => ({
              user_id: u._id,
              availability_status: 'offline',
              kyc_status: 'pending',
              is_verified: false,
              isDeleted: false
            })),
            { ordered: false }
          ).catch(() => {});
        }
      }
    } catch (syncErr: any) {
      // Fail-safe non-blocking sync
    }

    const [providers, total] = await Promise.all([
      Provider.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Provider.countDocuments(filter)
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
    const userIds = [...new Set(providers.map(p => p.user_id?.toString()).filter(Boolean))];
    const users = userIds.length ? await getUsersBatch(userIds) : [];
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));

    const enriched = providers.map(p => {
      const u: any = userMap.get(String(p.user_id));
      return {
        ...p,
        user_id: u ?? p.user_id,
        name: u?.name || (p as any).name || (p as any).business_name || 'Provider',
        email: u?.email || (p as any).email || 'N/A',
        phone: u?.phone || (p as any).phone || (p as any).mobile || 'N/A'
      };
    });

    res.json(enriched);
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
      { $match: { isDeleted: { $ne: true } } },
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
        const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
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

    await initializeProviderWalletOnce(provider._id, 0);

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

    const oldKycStatus = provider.kyc_status;

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

    // Trigger Verification Approved/Rejected notifications
    if (status && status !== oldKycStatus && provider.user_id) {
      const bUserId = provider.user_id.toString();
      if (status === 'verified') {
        sendProviderNotification(
          bUserId,
          'Profile Verification Approved',
          'Congratulations! Your profile verification has been approved.',
          'system_alert',
          { kyc_status: 'verified' }
        ).catch(err => console.error('[NOTIFICATION] Failed to send verification approved notification:', err));
      } else if (status === 'rejected') {
        sendProviderNotification(
          bUserId,
          'Profile Verification Rejected',
          `Unfortunately, your profile verification was rejected. Reason: ${kyc_rejection_reason || 'Documents did not meet our verification standards.'}`,
          'system_alert',
          { kyc_status: 'rejected' }
        ).catch(err => console.error('[NOTIFICATION] Failed to send verification rejected notification:', err));
      }
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

export const releaseProviderAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { force } = req.body;
    const providerId = req.params.id;

    const provider = await Provider.findById(providerId);
    if (!provider) {
      res.status(404).json({ success: false, message: 'Provider not found' });
      return;
    }

    if (provider.isBusy && force !== true) {
      const hasActive = await checkActiveBookingByProvider(providerId);
      if (hasActive) {
        res.status(409).json({
          success: false,
          warning: true,
          message: 'Provider has an active booking. Are you sure you want to release them?'
        });
        return;
      }
    }

    provider.availability_status = 'available';
    provider.isBusy = false;
    await provider.save();

    res.json({ success: true, message: 'Provider released successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDispatchHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const jobRequests = await JobRequest.find({ booking_id: new mongoose.Types.ObjectId(bookingId) })
      .populate('provider_id')
      .sort({ createdAt: -1 })
      .lean();

    const providerUserIds = jobRequests.map((jr: any) => jr.provider_id?.user_id?.toString()).filter(Boolean);
    const users = providerUserIds.length ? await getUsersBatch(providerUserIds) : [];
    const userMap = new Map<string, any>(users.map((u: any) => [String(u._id), u]));

    const history = jobRequests.map((jr: any) => {
      const provider = jr.provider_id;
      const user = provider ? userMap.get(String(provider.user_id)) : null;
      return {
        _id: jr._id,
        provider_id: provider?._id,
        provider_name: user?.name || 'Unknown Provider',
        provider_phone: user?.phone || 'N/A',
        status: jr.status,
        distance: jr.distance ? `${(jr.distance / 1000).toFixed(1)} km` : 'N/A',
        sent_at: jr.createdAt,
        expired_at: jr.expired_at || jr.updatedAt,
        expired_reason: jr.expired_reason || (jr.status === 'expired' ? 'Timeout' : undefined),
        provider_rank: jr.provider_rank || 1
      };
    });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get kit purchase data for admin panel
// @route   GET /api/providers/kit-purchases
// @access  Private/Admin
export const getKitPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await ProviderOrder.find({
      payment_status: { $in: ['paid', 'pending', 'skipped'] }
    }).sort({ createdAt: -1 }).lean();

    // Resolve provider names
    const providerIds = [...new Set(orders.map(o => o.provider_id.toString()))];
    const providers = await Provider.find({ _id: { $in: providerIds } }).lean();
    const userIds = [...new Set(providers.map(p => p.user_id?.toString()).filter(Boolean))];
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, ResolvedUser>(users.map((u: any) => [u._id.toString(), u]));
    const providerUserMap = new Map(providers.map(p => [p._id.toString(), p.user_id?.toString()]));

    const enrichedOrders = orders.map(order => {
      const userId = providerUserMap.get(order.provider_id.toString());
      const user = userId ? userMap.get(userId) : null;
      return {
        _id: order._id,
        providerName: user?.name || 'Unknown',
        providerPhone: user?.phone || '',
        paymentStatus: order.payment_status,
        kitName: order.kit?.kit_name || '',
        kitSize: order.kit?.size || '',
        amount: order.grand_total,
        grandTotal: order.grand_total,
        accessories: order.accessories || [],
        paymentId: order.payment_id || '',
        paidAt: order.paidAt || null,
        razorpayOrderId: order.razorpay_order_id || '',
        createdAt: order.createdAt,
      };
    });

    // Stats
    const paidOrders = orders.filter(o => o.payment_status === 'paid');
    const stats = {
      totalKitsSold: paidOrders.length,
      pendingOrders: orders.filter(o => o.payment_status === 'pending').length,
      totalRevenue: paidOrders.reduce((sum, o) => sum + (o.grand_total || 0), 0),
    };

    res.json({ stats, orders: enrichedOrders });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get kit tracking details for all providers
// @route   GET /api/providers/kit-tracking
// @access  Private/Admin
export const getKitTracking = async (req: Request, res: Response): Promise<void> => {
  try {
    const providers = await Provider.find({ isDeleted: false }).lean();
    const orders = await ProviderOrder.find().lean();

    const orderMap = new Map<string, any>();
    for (const order of orders) {
      orderMap.set(order.provider_id.toString(), order);
    }

    const userIds = [...new Set(providers.map(p => p.user_id?.toString()).filter(Boolean))];
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, ResolvedUser>(users.map((u: any) => [u._id.toString(), u]));

    const enrichedProviders = providers.map(p => {
      const user = p.user_id ? userMap.get(p.user_id.toString()) : null;
      const order = orderMap.get(p._id.toString());

      let status = 'Not Purchased';
      let purchaseDate = null;
      let orderId = '';

      if (p.kitPurchased) {
        status = 'Purchased';
        purchaseDate = p.kitPurchasedAt || order?.paidAt || order?.updatedAt || null;
        orderId = order?.razorpay_order_id || '';
      } else if (order && order.payment_status === 'pending') {
        status = 'Pending Payment';
        orderId = order?.razorpay_order_id || '';
      }

      return {
        _id: p._id,
        providerName: user?.name || 'Unknown',
        providerPhone: user?.phone || '',
        status,
        purchaseDate,
        orderId,
      };
    });

    const stats = {
      purchased: enrichedProviders.filter(p => p.status === 'Purchased').length,
      pendingPayment: enrichedProviders.filter(p => p.status === 'Pending Payment').length,
      notPurchased: enrichedProviders.filter(p => p.status === 'Not Purchased').length,
    };

    res.json({ stats, providers: enrichedProviders });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get paid kit orders for branch/HUD pickup management
// @route   GET /api/providers/kit-pickups
// @access  Private/Admin
export const getKitPickups = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await ProviderOrder.find({ payment_status: 'paid' }).sort({ updatedAt: -1 }).lean();

    const providerIds = [...new Set(orders.map(o => o.provider_id.toString()))];
    const providers = await Provider.find({ _id: { $in: providerIds } }).lean();
    const userIds = [...new Set(providers.map(p => p.user_id?.toString()).filter(Boolean))];
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, ResolvedUser>(users.map((u: any) => [u._id.toString(), u]));
    const providerUserMap = new Map(providers.map(p => [p._id.toString(), p.user_id?.toString()]));

    const enrichedOrders = orders.map(order => {
      const userId = providerUserMap.get(order.provider_id.toString());
      const user = userId ? userMap.get(userId) : null;
      return {
        _id: order._id,
        providerId: order.provider_id,
        providerName: user?.name || 'Unknown',
        providerPhone: user?.phone || '',
        kitName: order.kit?.kit_name || '',
        kitSize: order.kit?.size || '',
        amount: order.grand_total,
        paymentId: order.payment_id || '',
        paidAt: order.paidAt || null,
        fulfillmentStatus: order.fulfillmentStatus || 'awaiting_approval',
        razorpayOrderId: order.razorpay_order_id || '',
        accessories: order.accessories || [],
        createdAt: order.createdAt,
      };
    });

    res.json(enrichedOrders);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update kit pickup fulfillment status & trigger notification on ready_for_pickup
// @route   PUT /api/providers/kit-pickups/:id/fulfillment
// @access  Private/Admin
export const updateKitPickupStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fulfillmentStatus } = req.body;

    if (!['awaiting_approval', 'ready_for_pickup', 'collected', 'completed'].includes(fulfillmentStatus)) {
      res.status(400).json({ message: 'Invalid fulfillment status' });
      return;
    }

    const order = await ProviderOrder.findById(id);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    order.fulfillmentStatus = fulfillmentStatus;
    await order.save();

    const provider = await Provider.findById(order.provider_id);
    if (provider) {

      // Trigger provider notification if marked ready_for_pickup
      if (fulfillmentStatus === 'ready_for_pickup') {
        await sendProviderNotification(
          provider.user_id.toString(),
          'Starter Kit Ready for Pickup',
          'Your starter kit is ready for pickup.\nBranch: Whitefield HUD\nPickup Hours: 10:00 AM – 6:00 PM\nBring: ID proof and registered mobile number',
          'kit_pickup_ready',
          { orderId: order._id }
        );
      }
    }

    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Subscription Policies & Admin Subscription Management ──────────────────────

export const getSubscriptionPolicies = async (req: Request, res: Response): Promise<void> => {
  try {
    let policies = await SubscriptionPolicy.find({}).sort({ createdAt: 1 }).lean();
    if (policies.length === 0) {
      // Seed default dynamic policies if empty
      policies = await SubscriptionPolicy.insertMany([
        { policyKey: 'wallet_based', name: 'Wallet Based', description: 'Standard wallet balance model requiring minimum credit and deducting lead fees per job.', requiresWallet: true, deductsLeadFee: true, durationDays: 0, gracePeriodDays: 7, isActive: true },
        { policyKey: 'free_trial', name: 'Free Trial', description: 'Promotional free access for onboarded providers.', requiresWallet: false, deductsLeadFee: false, durationDays: 30, gracePeriodDays: 7, isActive: true },
        { policyKey: 'premium', name: 'Premium Tier', description: 'Exclusive premium tier with unlimited zero-fee bookings.', requiresWallet: false, deductsLeadFee: false, durationDays: 365, gracePeriodDays: 7, isActive: true },
        { policyKey: 'sponsored', name: 'Sponsored Tier', description: 'Custom sponsored access granted by partners or admins.', requiresWallet: false, deductsLeadFee: false, durationDays: 0, gracePeriodDays: 7, isActive: true },
      ]) as any;
    }
    res.json(policies);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const upsertSubscriptionPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { policyKey, name, description, requiresWallet, deductsLeadFee, durationDays, gracePeriodDays, isActive } = req.body;
    const policy = await SubscriptionPolicy.findOneAndUpdate(
      { policyKey },
      { $set: { name, description, requiresWallet, deductsLeadFee, durationDays, gracePeriodDays, isActive } },
      { new: true, upsert: true }
    );
    res.json({ success: true, policy });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProviderSubscriptionAdmin = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { subscriptionType, accessMode, durationOption, customEndDate, reason } = req.body;

    const provider = await Provider.findById(id);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const prevState = {
      subscriptionType: provider.subscriptionType,
      accessMode: provider.accessMode,
      subscriptionStatus: provider.subscriptionStatus,
      isFreeAccessEnabled: provider.isFreeAccessEnabled,
      freeAccessStartDate: provider.freeAccessStartDate,
      freeAccessEndDate: provider.freeAccessEndDate,
      gracePeriodEndDate: provider.gracePeriodEndDate,
      freeAccessReason: provider.freeAccessReason,
    };

    const now = new Date();
    provider.subscriptionType = subscriptionType || 'wallet_based';
    provider.accessMode = accessMode || 'standard';
    provider.freeAccessReason = reason || 'Admin Configured';
    provider.freeAccessAssignedBy = req.user?.name || 'Admin';

    if (subscriptionType === 'free_trial' || accessMode === 'premium' || accessMode === 'sponsored') {
      provider.isFreeAccessEnabled = true;
      provider.subscriptionStatus = 'active';
      provider.freeAccessStartDate = now;
      provider.gracePeriodEndDate = null;

      if (durationOption === '7_days') {
        provider.freeAccessEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (durationOption === '1_month' || durationOption === '30_days') {
        provider.freeAccessEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (durationOption === '3_months' || durationOption === '90_days') {
        provider.freeAccessEndDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      } else if (durationOption === 'custom' && customEndDate) {
        provider.freeAccessEndDate = new Date(customEndDate);
      } else if (durationOption === 'permanent') {
        provider.freeAccessEndDate = null; // Permanent
      }
    } else {
      // Revert to wallet based
      provider.isFreeAccessEnabled = false;
      provider.subscriptionStatus = 'active';
      provider.freeAccessEndDate = null;
      provider.gracePeriodEndDate = null;
    }

    await provider.save();

    await SubscriptionAuditLog.create({
      providerId: provider._id,
      action: provider.isFreeAccessEnabled ? 'grant_free_access' : 'change_policy',
      performedBy: 'Admin',
      adminUserId: req.user?._id,
      adminName: req.user?.name || 'Admin',
      reason: reason || 'Admin Subscription Override',
      previousState: prevState,
      newState: {
        subscriptionType: provider.subscriptionType,
        accessMode: provider.accessMode,
        subscriptionStatus: provider.subscriptionStatus,
        isFreeAccessEnabled: provider.isFreeAccessEnabled,
        freeAccessStartDate: provider.freeAccessStartDate,
        freeAccessEndDate: provider.freeAccessEndDate,
      }
    });

    res.json({ success: true, provider });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getSubscriptionDashboardStatsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      walletBasedCount,
      freeTrialCount,
      premiumCount,
      sponsoredCount,
      expiringThisWeekCount,
      gracePeriodCount,
      expiredCount,
    ] = await Promise.all([
      Provider.countDocuments({ isFreeAccessEnabled: false, isDeleted: false }),
      Provider.countDocuments({ subscriptionType: 'free_trial', isFreeAccessEnabled: true, isDeleted: false }),
      Provider.countDocuments({ accessMode: 'premium', isDeleted: false }),
      Provider.countDocuments({ accessMode: 'sponsored', isDeleted: false }),
      Provider.countDocuments({ isFreeAccessEnabled: true, freeAccessEndDate: { $gte: now, $lte: weekFromNow }, isDeleted: false }),
      Provider.countDocuments({ subscriptionStatus: 'grace_period', isDeleted: false }),
      Provider.countDocuments({ subscriptionStatus: 'expired', isDeleted: false }),
    ]);

    res.json({
      walletBased: walletBasedCount,
      freeTrial: freeTrialCount,
      premium: premiumCount,
      sponsored: sponsoredCount,
      expiringThisWeek: expiringThisWeekCount,
      gracePeriod: gracePeriodCount,
      expired: expiredCount,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProviderAuditLogsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const filter = providerId ? { providerId } : {};
    const logs = await SubscriptionAuditLog.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getWalletCenterStatsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      lowBalanceCount,
      freeAccessCount,
      gracePeriodCount,
      blockedCodCount,
    ] = await Promise.all([
      Provider.countDocuments({
        isDeleted: false,
        isFreeAccessEnabled: false,
        $expr: {
          $lt: [
            { $add: [{ $subtract: ['$walletBalance', '$reservedBalance'] }, { $ifNull: ['$creditLimit', 0] }] },
            100
          ]
        }
      }),
      Provider.countDocuments({ isFreeAccessEnabled: true, isDeleted: false }),
      Provider.countDocuments({ subscriptionStatus: 'grace_period', isDeleted: false }),
      Provider.countDocuments({ isDispatchBlockedByCod: true, isDeleted: false }),
    ]);

    res.json({
      lowBalanceCount,
      freeAccessCount,
      gracePeriodCount,
      blockedCodCount,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const searchProvidersInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyword, userIds } = req.body;
    const filterConditions: any[] = [];

    if (Array.isArray(userIds) && userIds.length > 0) {
      const validUserObjectIds = userIds
        .filter((id: any) => mongoose.Types.ObjectId.isValid(id))
        .map((id: any) => new mongoose.Types.ObjectId(id));
      if (validUserObjectIds.length > 0) {
        filterConditions.push({ user_id: { $in: validUserObjectIds } });
      }
    }

    if (keyword && typeof keyword === 'string' && keyword.trim()) {
      const searchRegex = new RegExp(keyword.trim(), 'i');
      filterConditions.push({ aadhar_id: searchRegex });
    }

    if (filterConditions.length === 0) {
      res.json([]);
      return;
    }

    const providers = await Provider.find({
      isDeleted: { $ne: true },
      $or: filterConditions
    }).select('_id user_id').limit(100).lean();

    res.json(providers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};


