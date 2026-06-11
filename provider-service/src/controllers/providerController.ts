import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Provider } from '../models/Provider';
import { ProviderService } from '../models/ProviderService';
import { JobRequest } from '../models/JobRequest';
import { saveFileToCloud, deleteFileFromCloud } from '../utils/fileHelper';
import { emitToUser } from '../services/socketService';
import { VerificationAction } from '../models/VerificationAction';
import { sendEmail } from '../utils/email';

interface ResolvedUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  profile_image?: string;
  status?: string;
}

interface ResolvedBooking {
  _id: string;
  status: string;
  provider_id?: string;
  user_id: string;
}

interface ResolvedSubService {
  _id: string;
  subservice_name: string;
}

// Lazy-loaded connections to other DBs for manual joins
let authConnection: mongoose.Connection | null = null;
let bookingConnection: mongoose.Connection | null = null;
let catalogConnection: mongoose.Connection | null = null;

let UserModel: any = null;
let BookingModel: any = null;
let SubServiceModel: any = null;
let AddressModel: any = null;

const getAddressModel = () => {
  if (!AddressModel) {
    if (!authConnection) {
      const authDbURI = process.env.AUTH_DB_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/auth_db?appName=Cluster0';
      authConnection = mongoose.createConnection(authDbURI);
    }
    const addressSchema = new Schema({}, { strict: false });
    AddressModel = authConnection.model('Address', addressSchema, 'addresses');
  }
  return AddressModel;
};

const getUserModel = () => {
  if (!UserModel) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/auth_db?appName=Cluster0';
    authConnection = mongoose.createConnection(authDbURI);
    
    const userSchema = new Schema({
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      password: { type: String, required: true },
      role: { type: String, default: 'provider' },
      profile_image: { type: String, default: '' },
      status: { type: String, default: 'active' }
    }, { strict: false });
    
    UserModel = authConnection.model('User', userSchema, 'users');
  }
  return UserModel;
};

const getBookingModel = () => {
  if (!BookingModel) {
    const bookingDbURI = process.env.BOOKING_DB_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/booking_db?appName=Cluster0';
    bookingConnection = mongoose.createConnection(bookingDbURI);
    
    const bookingSchema = new Schema({
      status: { type: String, required: true },
      provider_id: { type: Schema.Types.ObjectId },
      user_id: { type: Schema.Types.ObjectId, required: true }
    }, { strict: false });
    
    BookingModel = bookingConnection.model('Booking', bookingSchema, 'bookings');
  }
  return BookingModel;
};

const getSubServiceModel = () => {
  if (!SubServiceModel) {
    const catalogDbURI = process.env.CATALOG_DB_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/catalog_db?appName=Cluster0';
    catalogConnection = mongoose.createConnection(catalogDbURI);
    
    const subserviceSchema = new Schema({
      subservice_name: { type: String, required: true }
    }, { strict: false });
    
    SubServiceModel = catalogConnection.model('SubService', subserviceSchema, 'subservices');
  }
  return SubServiceModel;
};

// @desc    Get all providers
// @route   GET /api/providers
// @access  Private/Admin
export const getProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const providers = await Provider.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();

    const userIds = providers.map(p => p.user_id);
    const UModel = getUserModel();
    const users = await UModel.find({ _id: { $in: userIds } }).select('name email phone profile_image status').lean();
    const userMap = new Map<string, ResolvedUser>(users.map((u: any) => [String(u._id), u as ResolvedUser]));

    const providersWithServices = await Promise.all(
      providers.map(async (provider) => {
        const services = await ProviderService.find({ 
          provider_id: provider._id, 
          isDeleted: false 
        }).lean();

        const subserviceIds = services.flatMap((s: any) => s.subservice_ids);
        const SModel = getSubServiceModel();
        const subservices = await SModel.find({ _id: { $in: subserviceIds } }).select('subservice_name').lean();
        const subserviceMap = new Map<string, ResolvedSubService>(subservices.map((s: any) => [String(s._id), s as ResolvedSubService]));

        const processedServices = services.map((s: any) => ({
          ...s,
          subservice_ids: s.subservice_ids.map((id: any) => subserviceMap.get(String(id)) || { _id: id, subservice_name: '—' })
        }));

        const user = userMap.get(String(provider.user_id));

        return {
          ...provider,
          user_id: user ?? provider.user_id,
          services: processedServices
        };
      })
    );

    res.json(providersWithServices);
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

    const UModel = getUserModel();
    const user = await UModel.findById(provider.user_id).select('name email phone profile_image status').lean();

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
    const UModel = getUserModel();

    if (!user_id && email && password) {
      const userExists = await UModel.findOne({ email });
      if (userExists) {
        res.status(400).json({ message: 'User with this email already exists' });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = await UModel.create({
        name,
        email,
        phone,
        password: hashedPassword,
        role: 'provider',
        profile_image: profile_image || '',
      });
      user_id = newUser._id;
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

    const idProofRes = verification_docs?.id_proof_url ? await saveFileToCloud(verification_docs.id_proof_url, 'verification/pending') : '';

    const provider = await Provider.create({
      user_id,
      availability_status: availability_status || 'offline',
      is_verified: false,
      ...secureAadhar,
      bank_details: secureBank,
      verification_docs: typeof idProofRes === 'object' ? {
        id_proof_url: idProofRes.secure_url,
        public_id: idProofRes.public_id,
        resource_type: idProofRes.resource_type,
      } : {
        id_proof_url: idProofRes,
      }
    });

    if (Array.isArray(services)) {
      await Promise.all(
        services.map(async (serviceData) => {
          return ProviderService.create({
            provider_id: provider._id,
            ...serviceData
          });
        })
      );
    }

    const user = await UModel.findById(provider.user_id).select('name email phone profile_image status').lean();
    const allServices = await ProviderService.find({ provider_id: provider._id, isDeleted: false }).lean();

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

      const idProofRes = verification_docs?.id_proof_url ? await saveFileToCloud(verification_docs.id_proof_url, 'verification/pending') : '';

      provider.verification_docs = typeof idProofRes === 'object' ? {
        id_proof_url: idProofRes.secure_url,
        public_id: idProofRes.public_id,
        resource_type: idProofRes.resource_type,
      } : {
        id_proof_url: idProofRes,
      };
      
      if (status !== 'verified') {
        provider.kyc_status = 'pending';
        provider.is_verified = false;
      }
    }

    const updated = await provider.save();
    const UModel = getUserModel();
    const user = await UModel.findById(provider.user_id).select('name email phone profile_image status').lean();
    
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

// @desc    Process verification action (Approve/Reject/Request Docs)
// @route   POST /api/providers/:id/verification-action
// @access  Private/Admin
export const processVerificationAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const providerId = req.params.id;
    const { action_type, reasons, custom_message, requested_docs } = req.body;
    const adminId = req.user?._id;

    if (!adminId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const provider = await Provider.findById(providerId);
    if (!provider || !provider.user_id) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const UModel = getUserModel();
    const providerUser = await UModel.findById(provider.user_id).select('name email').lean();

    if (!providerUser) {
      res.status(404).json({ message: 'Provider User not found' });
      return;
    }

    // 1. Log the action
    await VerificationAction.create({
      provider_id: provider._id,
      action_type,
      reasons: reasons || [],
      custom_message,
      requested_docs: requested_docs || [],
      admin_id: new mongoose.Types.ObjectId(adminId as string),
    });

    // 2. Update Provider Status
    if (action_type === 'rejected') {
      provider.kyc_status = 'rejected';
      provider.is_verified = false;
      provider.kyc_rejection_reason = custom_message || reasons?.join(', ');
    } else if (action_type === 'requested_docs') {
      provider.kyc_status = 'pending';
      // Store the requested docs in the rejection reason or a new field for the provider to see
      provider.kyc_rejection_reason = `Requested Documents: ${requested_docs?.join(', ')}. Note: ${custom_message || ''}`;
    } else if (action_type === 'approved') {
      provider.kyc_status = 'verified';
      provider.is_verified = true;
      provider.verified_at = new Date();
      provider.verification_docs_expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      provider.kyc_rejection_reason = undefined;
    }
    
    await provider.save();

    // 3. Send Email
    let emailSubject = '';
    let emailMessage = '';

    if (action_type === 'rejected') {
      emailSubject = 'Verification Request Rejected';
      emailMessage = `Hi ${providerUser.name},\n\nWe reviewed your partner verification request.\n\nUnfortunately, your verification could not be approved for the following reasons:\n`;
      if (reasons && reasons.length > 0) {
        reasons.forEach((r: string) => { emailMessage += `• ${r}\n`; });
      }
      if (custom_message) {
        emailMessage += `\nAdditional comments from admin:\n"${custom_message}"\n`;
      }
      emailMessage += `\nPlease update your documents and resubmit verification.\n\nRegards,\nFixvo Verification Team`;
    } else if (action_type === 'requested_docs') {
      emailSubject = 'Additional Documents Required';
      emailMessage = `Hi ${providerUser.name},\n\nTo continue your partner verification process, please upload the following documents:\n`;
      if (requested_docs && requested_docs.length > 0) {
        requested_docs.forEach((doc: string) => { emailMessage += `• ${doc}\n`; });
      }
      if (custom_message) {
        emailMessage += `\nAdditional request from admin:\n"${custom_message}"\n`;
      }
      emailMessage += `\nYou can upload these documents from your profile verification page.\n\nRegards,\nFixvo Verification Team`;
    } else if (action_type === 'approved') {
      emailSubject = 'Provider Verification Approved';
      emailMessage = `Dear ${providerUser.name},\n\nCongratulations!\n\nYour account has been successfully verified and approved.\n\nYou can now access all provider functionalities and start accepting service requests.\n\nRegards,\nFixvoHub Team`;
    }

    if (emailSubject && emailMessage) {
      await sendEmail({
        email: providerUser.email,
        subject: emailSubject,
        message: emailMessage
      });
    }

    res.json({ message: 'Action processed successfully', status: provider.kyc_status });
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
      provider = await Provider.findById(newProvider._id).lean();
    }

    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const services = await ProviderService.find({ 
      provider_id: provider._id, 
      isDeleted: false 
    }).lean();

    const subserviceIds = services.flatMap((s: any) => s.subservice_ids);
    const SModel = getSubServiceModel();
    const subservices = await SModel.find({ _id: { $in: subserviceIds } }).select('subservice_name').lean();
    const subserviceMap = new Map<string, ResolvedSubService>(subservices.map((s: any) => [String(s._id), s as ResolvedSubService]));

    let processedServices = services.map((s: any) => ({
      ...s,
      subservice_ids: s.subservice_ids.map((id: any) => subserviceMap.get(String(id)) || { _id: id, subservice_name: '—' })
    }));

    const profileData = { ...provider } as any;
    const UModel = getUserModel();
    const user = await UModel.findById(provider.user_id).select('name email phone profile_image status').lean();
    profileData.user_id = user ?? provider.user_id;

    // Fetch dashboard stats from Bookings
    const BModel = getBookingModel();
    const allBookings = await BModel.find({ provider_id: provider._id }).lean();
    
    profileData.total_jobs = allBookings.length;
    
    const completedBookings = allBookings.filter((b: any) => b.status === 'completed');
    profileData.completed_jobs = completedBookings.length;
    
    let earnings = 0;
    completedBookings.forEach((b: any) => {
      earnings += b.provider_payout || (b.payable_amount ? b.payable_amount * 0.8 : 0);
    });
    profileData.earnings = earnings;
    profileData.overall_rating = 4.8; // Example default rating

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
    }

    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const { availability_status, aadhar_id, bank_details, verification_docs } = req.body;

    provider.availability_status = availability_status ?? provider.availability_status;
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
    const UModel = getUserModel();
    const user = await UModel.findById(provider.user_id).select('name email phone profile_image status').lean();
    
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

// @desc    System task to cleanup expired KYC and Service documents
// @access  Internal/Admin
export const cleanupExpiredDocuments = async (): Promise<{ deletedCount: number }> => {
  try {
    let count = 0;

    const expiredProviders = await Provider.find({
      verification_docs_expiry: { $lte: new Date() },
      kyc_status: 'verified'
    });

    for (const provider of expiredProviders) {
      if (provider.verification_docs) {
        if (provider.verification_docs.public_id) {
          await deleteFileFromCloud(provider.verification_docs.public_id, provider.verification_docs.resource_type);
        } else if (provider.verification_docs.id_proof_url) {
          await deleteFileFromCloud(provider.verification_docs.id_proof_url);
        }
        
        provider.verification_docs = {
          id_proof_url: ''
        };
        provider.verification_docs_expiry = undefined;
        await provider.save();
        count++;
      }
    }

    const expiredServices = await ProviderService.find({
      documents_expiry: { $lte: new Date() }
    });

    for (const service of expiredServices) {
      if (service.documents && service.documents.length > 0) {
        for (const doc of service.documents) {
          if (doc.public_id) {
            await deleteFileFromCloud(doc.public_id, doc.resource_type);
          } else if (doc.file_url) {
            await deleteFileFromCloud(doc.file_url);
          }
        }
        
        service.documents = [];
        service.documents_expiry = undefined;
        await service.save();
        count++;
      }
    }

    console.log(`[STORAGE CLEANUP] Successfully removed documents from ${count} records.`);
    return { deletedCount: count };
  } catch (error) {
    console.error('[STORAGE CLEANUP] Task failed:', error);
    return { deletedCount: 0 };
  }
};

// @desc    Get pending job requests for current provider
// @route   GET /api/providers/job-requests
// @access  Private/Provider
export const getMyJobRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const requests = await JobRequest.find({
      provider_id: provider._id,
      status: 'pending'
    }).sort({ createdAt: -1 }).lean();

    const bookingIds = requests.map(r => r.booking_id);
    const BModel = getBookingModel();
    const bookings = await BModel.find({ _id: { $in: bookingIds } }).lean();
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id), b]));

    const userIds = bookings.map((b: any) => b.user_id);
    const subserviceIds = bookings.map((b: any) => b.subservice_id);
    const addressIds = bookings.map((b: any) => b.address_id);
    
    const UModel = getUserModel();
    const users = await UModel.find({ _id: { $in: userIds } }).select('name email phone profile_image').lean();
    const userMap = new Map<string, any>(users.map((u: any) => [String(u._id), u]));

    const SModel = getSubServiceModel();
    const subservices = await SModel.find({ _id: { $in: subserviceIds } }).lean();
    const subserviceMap = new Map<string, any>(subservices.map((s: any) => [String(s._id), s]));

    const AModel = getAddressModel();
    const addresses = await AModel.find({ _id: { $in: addressIds } }).lean();
    const addressMap = new Map<string, any>(addresses.map((a: any) => [String(a._id), a]));

    const mappedRequests = requests.map(r => {
      const booking = bookingMap.get(String(r.booking_id)) as any;
      if (!booking) return null;

      const user = userMap.get(String(booking.user_id));
      const subservice = subserviceMap.get(String(booking.subservice_id));
      const address = addressMap.get(String(booking.address_id));

      const serviceName = subservice?.subservice_name || subservice?.service_id?.service_name || 'New Service Request';

      return {
        _id: r._id,
        request_id: r._id,
        booking_id: {
          _id: booking._id,
          booking_id: booking.booking_id,
          user_id: user ?? booking.user_id,
          address_id: address ?? booking.address_id
        },
        display_id: booking.booking_id,
        service_name: serviceName,
        amount: booking.payable_amount,
        location: {
          address: address?.address_line || 'Address',
          city: address?.city || 'City',
          distance: r.distance ? (r.distance / 1000).toFixed(1) + ' km' : 'Nearby'
        },
        scheduled_at: booking.scheduled_at,
        booking_time: booking.booking_time,
        expires_at: r.expires_at,
        status: r.status
      };
    }).filter(Boolean);

    res.json(mappedRequests);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Accept a job request
// @route   POST /api/providers/job-requests/:id/accept
// @access  Private/Provider
export const acceptJobRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const request = await JobRequest.findById(req.params.id);
    if (!request || request.status !== 'pending') {
      res.status(400).json({ message: 'Request is no longer valid or has expired' });
      return;
    }

    const BModel = getBookingModel();
    const booking = await BModel.findById(request.booking_id);
    if (!booking || booking.status !== 'pending') {
      res.status(400).json({ message: 'Booking is already assigned or unavailable' });
      return;
    }

    // 1. Assign provider and update booking status
    booking.provider_id = provider._id;
    booking.status = 'accepted';
    await booking.save();

    // 2. Mark this JobRequest as accepted
    request.status = 'accepted';
    await request.save();

    // 3. Remove all competing JobRequests for the same booking
    await JobRequest.updateMany(
      { booking_id: booking._id, _id: { $ne: request._id } },
      { status: 'removed' }
    );

    // 4. Mark provider as busy
    provider.availability_status = 'busy';
    provider.isBusy = true;
    await provider.save();

    // ── Notify customer via socket ───────────────────────────────────────────────
    emitToUser(booking.user_id.toString(), 'booking_accepted', {
      booking_id: booking._id,
      provider: {
        name:          req.user?.name,
        profile_image: req.user?.profile_image
      }
    });

    res.json({ message: 'Job accepted successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject a job request
// @route   POST /api/providers/job-requests/:id/reject
// @access  Private/Provider
export const rejectJobRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await JobRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }

    request.status = 'rejected';
    await request.save();

    res.json({ message: 'Job rejected successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update provider live location
// @route   PATCH /api/providers/live-location
// @access  Private/Provider
export const updateLiveLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { latitude, longitude } = req.body;
    const provider = await Provider.findOneAndUpdate(
      { user_id: req.user?._id },
      {
        live_location: { type: 'Point', coordinates: [longitude, latitude] },
        lastActiveAt: new Date(),
        isOnline: true
      },
      { new: true }
    );
    res.json({ message: 'Live location updated', location: provider?.live_location });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update provider availability status
// @route   PUT /api/providers/availability
// @access  Private/Provider
export const updateMyAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    
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

    const provider = await Provider.findOneAndUpdate(
      { user_id: req.user?._id },
      update,
      { new: true }
    );
    res.json({ message: 'Availability updated', status: provider?.availability_status, isOnline: provider?.isOnline });
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

    // 1. Find ProviderService records offering this subservice
    const providerServices = await ProviderService.find({
      subservice_ids: new mongoose.Types.ObjectId(subservice_id),
      is_active: true,
      isDeleted: false
    }).select('provider_id').lean();

    const providerIds = providerServices.map((ps: any) => ps.provider_id);
    if (providerIds.length === 0) {
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
    const AModel = getAddressModel();
    const LModel = getLocationModel();

    let coordinates: [number, number] | null = null;
    let cityLocationId: mongoose.Types.ObjectId | null = null;
    let resolvedLocationText = location_name;

    if (location_id && location_id !== 'custom' && mongoose.Types.ObjectId.isValid(location_id)) {
      // Try as saved address first
      const address = await AModel.findById(location_id).lean() as any;
      if (address) {
        if (address.coordinates?.coordinates) coordinates = address.coordinates.coordinates;
        if (address.city) resolvedLocationText = address.city;
      } else {
        // Try as Location document (city / area / pincode)
        const loc = await LModel.findById(location_id).lean() as any;
        if (loc) {
          cityLocationId = loc._id;
          resolvedLocationText = loc.name;
          if (loc.coordinates?.coordinates) coordinates = loc.coordinates.coordinates;
        }
      }
    }

    // Match by name if we still don't have a cityLocationId
    if (!cityLocationId && resolvedLocationText) {
      const loc = await LModel.findOne({
        name: new RegExp('^' + resolvedLocationText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
        status: 'active'
      }).lean() as any;
      if (loc) cityLocationId = loc._id;
    }

    // ── Candidate lookup ─────────────────────────────────────────────────────
    // 2a. Geo-proximity check (within 30 km)
    if (coordinates) {
      const geoCandidates = await Provider.find({
        ...baseQuery,
        live_location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates },
            $maxDistance: 30000
          }
        }
      }).lean();
      if (geoCandidates.length > 0) {
        res.json({ available: true });
        return;
      }
    }

    // 2b. service_locations match (city ID stored on provider)
    if (cityLocationId) {
      const locCandidates = await Provider.find({
        ...baseQuery,
        service_locations: cityLocationId
      }).lean();
      if (locCandidates.length > 0) {
        res.json({ available: true });
        return;
      }
    }

    // 2c. Pincode / area fallback – look up child location IDs under the resolved city
    if (location_id && mongoose.Types.ObjectId.isValid(location_id)) {
      const childLocs = await LModel.find({ parent_id: location_id, status: 'active' }).lean() as any[];
      const childIds = childLocs.map((l: any) => l._id);
      if (childIds.length > 0) {
        const areaCandidates = await Provider.find({
          ...baseQuery,
          service_locations: { $in: childIds }
        }).lean();
        if (areaCandidates.length > 0) {
          res.json({ available: true });
          return;
        }
      }
    }

    res.json({ available: false });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Helper lazy-loaded models (auth_db) for providerController
let _authConn2: mongoose.Connection | null = null;
let _LocationModel2: any = null;
let _AddressModel2: any = null;

const getLocationModel = () => {
  if (!_LocationModel2) {
    if (!_authConn2) {
      _authConn2 = mongoose.createConnection(process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db');
    }
    _LocationModel2 = _authConn2.model('Location', new Schema({}, { strict: false }), 'locations');
  }
  return _LocationModel2;
};



