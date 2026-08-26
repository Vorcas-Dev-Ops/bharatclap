import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { VerificationAction } from '../../models/VerificationAction';
import { ProviderService } from '../../models/ProviderService';
import { getUsersBatch, sendProviderNotification } from '../../utils/internalApi';
import { sendEmail } from '../../utils/email';
import { evaluateReferralStatusPipeline } from '../../services/providerReferralService';
import mongoose from 'mongoose';

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

    const users = await getUsersBatch([provider.user_id.toString()]);
    const providerUser = users.length ? users[0] : null;

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

    // 2. Update Provider Status + Onboarding Status
    if (action_type === 'rejected') {
      provider.kyc_status = 'rejected';
      provider.is_verified = false;
      provider.kyc_rejection_reason = custom_message || reasons?.join(', ');
      provider.onboarding_status = 'ACTION_REQUIRED';
    } else if (action_type === 'requested_docs') {
      provider.kyc_status = 'pending';
      // Store the requested docs in the rejection reason or a new field for the provider to see
      provider.kyc_rejection_reason = `Requested Documents: ${requested_docs?.join(', ')}. Note: ${custom_message || ''}`;
      provider.onboarding_status = 'ACTION_REQUIRED';
    } else if (action_type === 'approved') {
      provider.kyc_status = 'verified';
      provider.is_verified = true;
      provider.verified_at = new Date();
      provider.verification_docs_expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      provider.kyc_rejection_reason = undefined;
      provider.onboarding_status = 'APPROVED';
      
      await ProviderService.updateMany(
        { provider_id: provider._id },
        { documents_expiry: provider.verification_docs_expiry }
      );
    }
    
    await provider.save();

    // Trigger Verification Approved/Rejected notifications
    if (provider.user_id) {
      const bUserId = provider.user_id.toString();
      if (action_type === 'approved') {
        sendProviderNotification(
          bUserId,
          'Profile Verification Approved',
          'Congratulations! Your profile verification has been approved.',
          'system_alert',
          { kyc_status: 'verified' }
        ).catch(err => console.error('[NOTIFICATION] Failed to send verification approved notification:', err));
      } else if (action_type === 'rejected') {
        sendProviderNotification(
          bUserId,
          'Profile Verification Rejected',
          `Unfortunately, your profile verification was rejected. Reason: ${custom_message || reasons?.join(', ') || 'Not provided'}.`,
          'system_alert',
          { kyc_status: 'rejected' }
        ).catch(err => console.error('[NOTIFICATION] Failed to send verification rejected notification:', err));
      }
    }

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
      emailMessage += `\nPlease update your documents and resubmit verification.\n\nRegards,\nBharatClap Verification Team`;
    } else if (action_type === 'requested_docs') {
      emailSubject = 'Additional Documents Required';
      emailMessage = `Hi ${providerUser.name},\n\nTo continue your partner verification process, please upload the following documents:\n`;
      if (requested_docs && requested_docs.length > 0) {
        requested_docs.forEach((doc: string) => { emailMessage += `• ${doc}\n`; });
      }
      if (custom_message) {
        emailMessage += `\nAdditional request from admin:\n"${custom_message}"\n`;
      }
      emailMessage += `\nYou can upload these documents from your profile verification page.\n\nRegards,\nBharatClap Verification Team`;
    } else if (action_type === 'approved') {
      emailSubject = 'Provider Verification Approved';
      emailMessage = `Dear ${providerUser.name},\n\nCongratulations!\n\nYour account has been successfully verified and approved.\n\nYou can now access all provider functionalities and start accepting service requests.\n\nRegards,\nBharatClapHub Team`;
      
      // Update referral status in pipeline on KYC approval
      await evaluateReferralStatusPipeline(provider._id.toString());
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
