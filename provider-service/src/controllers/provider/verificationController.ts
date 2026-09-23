import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { ProviderRepository } from '../../repositories/providerRepository';
import { getDb } from '../../config/db';
import { getUsersBatch, sendProviderNotification } from '../../utils/internalApi';
import { sendEmail } from '../../utils/email';
import { evaluateReferralStatusPipeline } from '../../services/providerReferralService';

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

    const provider = await ProviderRepository.findById(providerId);
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

    const pool = getDb();

    // 1. Log the action
    await pool.query(
      `INSERT INTO provider.verification_actions (
         provider_id, action_type, status, details, performed_by
       ) VALUES (
         $1, $2, $3, $4,
         (SELECT id FROM auth.users WHERE id::text = $5 OR legacy_mongo_id = $5 LIMIT 1)
       )`,
      [
        provider.id,
        action_type,
        action_type === 'approved' ? 'approved' : 'pending',
        JSON.stringify({ reasons: reasons || [], custom_message, requested_docs: requested_docs || [] }),
        adminId
      ]
    );

    // 2. Update Provider Status + Onboarding Status
    let newKycStatus = provider.kyc_status;
    let isVerified = provider.is_verified;
    let newOnboardingStatus = provider.onboarding_status;

    if (action_type === 'rejected') {
      newKycStatus = 'rejected';
      isVerified = false;
      newOnboardingStatus = 'ACTION_REQUIRED';
    } else if (action_type === 'requested_docs') {
      newKycStatus = 'pending';
      newOnboardingStatus = 'ACTION_REQUIRED';
    } else if (action_type === 'approved') {
      newKycStatus = 'verified';
      isVerified = true;
      newOnboardingStatus = 'APPROVED';
    }

    await pool.query(
      `UPDATE provider.providers
       SET kyc_status = $1, is_verified = $2, onboarding_status = $3, updated_at = NOW()
       WHERE id = $4`,
      [newKycStatus, isVerified, newOnboardingStatus, provider.id]
    );

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
      await evaluateReferralStatusPipeline(provider.id);
    }

    if (emailSubject && emailMessage) {
      await sendEmail({
        email: providerUser.email,
        subject: emailSubject,
        message: emailMessage
      });
    }

    res.json({ message: 'Action processed successfully', status: newKycStatus });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
