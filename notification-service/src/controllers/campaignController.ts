import { Request, Response } from 'express';
import { CampaignRepository } from '../repositories/campaignRepository';
import { NotificationRepository } from '../repositories/notificationRepository';
import { fcmService } from '../services/fcmService';
import { AuthRequest } from '../middleware/authMiddleware';
import { getInternalServiceKey } from '@bharatclap/shared';

export const ALLOWED_SOUNDS = ['default', 'bharatclap_alert', 'partner_job_alert', 'silent'] as const;
export type AllowedSound = typeof ALLOWED_SOUNDS[number];

/**
 * Validates requested sound identifier against server whitelist.
 * Rejects arbitrary files/URLs/paths server-side with 400 Bad Request.
 */
export function validateSoundIdentifier(sound?: any): { valid: boolean; normalized: AllowedSound; error?: string } {
  if (sound === undefined || sound === null || sound === '') {
    return { valid: true, normalized: 'default' };
  }
  if (typeof sound !== 'string') {
    return { valid: false, normalized: 'default', error: 'Sound identifier must be a string' };
  }
  const s = sound.toLowerCase().trim();
  // Backward compatibility aliases
  if (s === 'booking') return { valid: true, normalized: 'bharatclap_alert' };
  if (s === 'job_alert') return { valid: true, normalized: 'partner_job_alert' };

  if ((ALLOWED_SOUNDS as readonly string[]).includes(s)) {
    return { valid: true, normalized: s as AllowedSound };
  }
  return {
    valid: false,
    normalized: 'default',
    error: `Invalid sound '${sound}'. Only allowed sounds are: ${ALLOWED_SOUNDS.join(', ')}`,
  };
}

/**
 * Resolves Android/iOS notification channel strictly based on notification type.
 * NEVER infers channel from title, body, campaign name, or sound.
 */
export function resolveChannelByType(type?: string): string {
  const norm = (type || '').toUpperCase().trim();
  if (norm === 'CONTENT_UPDATE' || norm === 'BANNER_UPDATE') return 'bharatclap_silent';
  if (norm === 'JOB' || norm === 'JOB_ALERT' || norm === 'JOB_ASSIGNED' || norm === 'NEW_JOB') return 'bharatclap_partner_jobs';
  if (norm === 'BOOKING' || norm === 'BOOKING_CONFIRMED' || norm === 'BOOKING_STATUS' || norm === 'BOOKING_ALERT') return 'bharatclap_booking';
  if (norm === 'PAYMENT' || norm === 'WALLET' || norm === 'PAYOUT' || norm === 'REFUND' || norm === 'PAYMENT_ALERT') return 'bharatclap_payment';
  if (norm === 'TRANSACTIONAL') return 'bharatclap_general';
  if (norm === 'MARKETING' || norm === 'PROMOTIONAL' || norm === 'ANNOUNCEMENT' || norm === 'SYSTEM') return 'bharatclap_general';
  return 'bharatclap_general';
}

/**
 * Enforces server-side sound consistency and silent update rules.
 * - CONTENT_UPDATE and BANNER_UPDATE are ALWAYS silent regardless of Admin input.
 * - Visible notifications strictly follow Type -> Channel -> Sound mapping.
 */
export function enforceConsistentSound(
  type?: string,
  requestedSound: string = 'default',
  soundEnabled: boolean = true
): {
  sound_enabled: boolean;
  sound: AllowedSound;
  channel: string;
} {
  const norm = (type || '').toUpperCase().trim();
  const channel = resolveChannelByType(type);

  // 1. Silent content updates server-side enforcement
  if (norm === 'CONTENT_UPDATE' || norm === 'BANNER_UPDATE') {
    return {
      sound_enabled: false,
      sound: 'silent',
      channel: 'bharatclap_silent',
    };
  }

  // If sound disabled or requested silent
  if (!soundEnabled || requestedSound === 'silent') {
    return {
      sound_enabled: false,
      sound: 'silent',
      channel,
    };
  }

  let effectiveSound = requestedSound as AllowedSound;

  // 2. Sound/Channel consistency matrix
  if (channel === 'bharatclap_partner_jobs') {
    if (effectiveSound !== 'default' && effectiveSound !== 'silent') {
      effectiveSound = 'partner_job_alert';
    }
  } else if (channel === 'bharatclap_booking') {
    if (effectiveSound !== 'default' && effectiveSound !== 'silent') {
      effectiveSound = 'bharatclap_alert';
    }
  } else if (channel === 'bharatclap_payment') {
    if (effectiveSound !== 'silent') {
      effectiveSound = 'default';
    }
  } else {
    // General / Marketing / Promotional / Announcement / System
    // Disallow partner siren for marketing notifications
    if (effectiveSound === 'partner_job_alert') {
      effectiveSound = 'bharatclap_alert';
    }
  }

  return {
    sound_enabled: true,
    sound: effectiveSound,
    channel,
  };
}

// Helper to broadcast notification to mobile ecosystem
export async function dispatchCampaignToEcosystem(campaign: any) {
  const { title, message, app, type, action_type, action_value, image_url, sound_enabled, sound } = campaign;
  const consistency = enforceConsistentSound(type, sound || 'default', sound_enabled !== false);
  const isSilent = type === 'CONTENT_UPDATE' || type === 'BANNER_UPDATE' || !consistency.sound_enabled || consistency.sound === 'silent';
  const effectiveSoundEnabled = consistency.sound_enabled;
  const effectiveSound = consistency.sound;
  const channelId = consistency.channel;

  const metadata = {
    campaign_id: campaign.id,
    action: action_type || 'open_home',
    action_value: action_value || '',
    image_url: image_url || '',
    type: type || 'PROMOTIONAL',
    notification_type: type || 'PROMOTIONAL',
    channel_id: channelId,
    sound: effectiveSound,
    sound_enabled: effectiveSoundEnabled ? 'true' : 'false',
  };

  // 1. Recipient-Level Delivery Audit & Deduplication
  const recipients = await CampaignRepository.getAudienceRecipients(
    app,
    campaign.audience_type || 'all',
    campaign.audience_filter
  );

  // Inserts deliveries with ON CONFLICT (campaign_id, recipient_id) DO NOTHING
  await CampaignRepository.recordDeliveries(campaign.id, recipients, 'sent');

  // 2. In-App Notification Store (for polling & offline sync)
  // Strict App separation: Customer only receives customer notifications, Partner only receives partner notifications
  if (app === 'both') {
    await NotificationRepository.createNotification({
      recipient_id: '00000000-0000-0000-0000-000000000000',
      recipient_type: 'customer',
      title,
      message,
      type,
      metadata,
    }).catch(() => {});

    await NotificationRepository.createNotification({
      recipient_id: '00000000-0000-0000-0000-000000000000',
      recipient_type: 'provider',
      title,
      message,
      type,
      metadata,
    }).catch(() => {});
  } else {
    const recipientType = app === 'provider' || app === 'partner' ? 'provider' : 'customer';
    await NotificationRepository.createNotification({
      recipient_id: '00000000-0000-0000-0000-000000000000',
      recipient_type: recipientType,
      title,
      message,
      type,
      metadata,
    }).catch(() => {});
  }

  // 3. Real-time Socket.io broadcast to connected active clients
  const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
  const internalKey = getInternalServiceKey();
  try {
    const importAxios = (await import('axios')).default;
    await importAxios.post(
      `${PROVIDER_SERVICE_URL}/api/internal/emit-broadcast`,
      {
        channel: app === 'provider' || app === 'partner' ? 'providers' : app === 'customer' ? 'customers' : 'all',
        event: isSilent ? 'content_invalidation' : 'custom_notification',
        data: {
          title,
          message,
          type,
          metadata,
          createdAt: new Date().toISOString(),
        },
      },
      { headers: { 'x-internal-service-key': internalKey }, timeout: 4000 }
    ).catch(() => {});
  } catch (_) {}

  // 4. FCM Authoritative Push Broadcast (handles Foreground, Background, and Terminated app states)
  const targetTopics = app === 'both' ? ['topic_customer', 'topic_provider'] : [app === 'provider' || app === 'partner' ? 'topic_provider' : 'topic_customer'];

  for (const topic of targetTopics) {
    await fcmService.sendPushNotification({
      token: topic,
      title: isSilent ? '' : title,
      body: isSilent ? '' : message,
      isSilent,
      channelId,
      sound: effectiveSound,
      soundEnabled: effectiveSoundEnabled,
      data: {
        campaign_id: campaign.id,
        action: action_type || 'open_home',
        action_value: action_value || '',
        image_url: image_url || '',
        notification_type: type || 'PROMOTIONAL',
        channel_id: channelId,
        sound: effectiveSound,
        sound_enabled: effectiveSoundEnabled ? 'true' : 'false',
      },
    }).catch(() => {});
  }

  // 5. Synchronize actual campaign metrics derived from delivery records
  await CampaignRepository.syncCampaignCounters(campaign.id);
}

// @desc    Create or schedule campaign
// @route   POST /api/notifications/campaigns
// @access  Private/Admin
export const createCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      message,
      app,
      audience_type,
      audience_filter,
      type,
      action_type,
      action_value,
      image_url,
      sound_enabled,
      sound,
      status,
      scheduled_at,
    } = req.body;

    if (!title || !message) {
      res.status(400).json({ message: 'Title and message are required fields' });
      return;
    }

    const soundValidation = validateSoundIdentifier(sound);
    if (!soundValidation.valid) {
      res.status(400).json({ message: soundValidation.error });
      return;
    }

    const consistency = enforceConsistentSound(type, soundValidation.normalized, sound_enabled !== false);

    const normalizedApp = app === 'partner' ? 'provider' : (app || 'customer');

    const estimatedRecipients = await CampaignRepository.estimateAudience(
      normalizedApp,
      audience_type || 'all',
      audience_filter
    );

    const isImmediateSend = (!scheduled_at && status !== 'draft') || status === 'sending';
    const initialStatus = status === 'draft' ? 'draft' : isImmediateSend ? 'sent' : 'scheduled';

    const campaign = await CampaignRepository.createCampaign({
      title,
      message,
      app: normalizedApp,
      audience_type: audience_type || 'all',
      audience_filter,
      type: type || 'PROMOTIONAL',
      action_type: action_type || 'open_home',
      action_value,
      image_url,
      sound_enabled: consistency.sound_enabled,
      sound: consistency.sound,
      status: initialStatus,
      scheduled_at: isImmediateSend ? null : scheduled_at,
      recipients_count: estimatedRecipients,
      created_by: (req.user as any)?.name || 'Admin',
    });

    if (isImmediateSend) {
      // Execute dispatch immediately
      await dispatchCampaignToEcosystem(campaign);
      await CampaignRepository.updateCampaign(campaign.id, {
        status: 'sent',
        sent_at: new Date(),
        delivered_count: estimatedRecipients,
      });
    }

    res.status(201).json(campaign);
  } catch (error: any) {
    console.error('[campaignController] createCampaign error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send test notification
// @route   POST /api/notifications/campaigns/test
// @access  Private/Admin
export const sendTestNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      message,
      app,
      type,
      action_type,
      action_value,
      image_url,
      sound_enabled,
      sound,
      target_id,
      target_role,
      target_phone,
    } = req.body;

    if (!title || !message) {
      res.status(400).json({ message: 'Title and message are required' });
      return;
    }

    const soundValidation = validateSoundIdentifier(sound);
    if (!soundValidation.valid) {
      res.status(400).json({ message: soundValidation.error });
      return;
    }

    const consistency = enforceConsistentSound(type, soundValidation.normalized, sound_enabled !== false);
    const recipientType = target_role === 'partner' || target_role === 'provider' ? 'provider' : 'customer';
    const effectiveSoundEnabled = consistency.sound_enabled;
    const effectiveSound = consistency.sound;
    const channelId = consistency.channel;

    // 1. Create personal notification for the test target
    if (target_id) {
      await NotificationRepository.createNotification({
        recipient_id: target_id,
        recipient_type: recipientType,
        title: `[TEST] ${title}`,
        message,
        type: type || 'PROMOTIONAL',
        metadata: {
          is_test: true,
          action: action_type || 'open_home',
          action_value: action_value || '',
          image_url: image_url || '',
          channel_id: channelId,
          sound: effectiveSound,
          sound_enabled: effectiveSoundEnabled ? 'true' : 'false',
        },
      });

      // Socket emit to test user
      const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
      const internalKey = getInternalServiceKey();
      try {
        const importAxios = (await import('axios')).default;
        await importAxios.post(
          `${PROVIDER_SERVICE_URL}/api/internal/emit`,
          {
            userId: target_id,
            event: recipientType === 'provider' ? 'provider_notification' : 'user_notification',
            data: {
              title: `[TEST] ${title}`,
              message,
              type,
              createdAt: new Date().toISOString(),
            },
          },
          { headers: { 'x-internal-service-key': internalKey }, timeout: 3000 }
        ).catch(() => {});
      } catch (_) {}
    }

    // 2. FCM Push dispatch
    await fcmService.sendPushNotification({
      token: target_id || 'test_device_token',
      title: `[TEST] ${title}`,
      body: message,
      channelId,
      sound: effectiveSound,
      soundEnabled: effectiveSoundEnabled,
      data: {
        action: action_type || 'open_home',
        action_value: action_value || '',
        image_url: image_url || '',
        channel_id: channelId,
        sound: effectiveSound,
        sound_enabled: effectiveSoundEnabled ? 'true' : 'false',
      },
    });

    res.json({
      success: true,
      message: `Test notification sent successfully to ${target_phone || target_id || 'target device'}!`,
    });
  } catch (error: any) {
    console.error('[campaignController] sendTestNotification error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all campaigns with paging & stats
// @route   GET /api/notifications/campaigns
// @access  Private/Admin
export const getCampaigns = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const status = req.query.status as string | undefined;

    const { data, total } = await CampaignRepository.getCampaigns({ status, page, limit });

    // Aggregate summary stats
    const [sentRes, schedRes, draftRes] = await Promise.all([
      CampaignRepository.getCampaigns({ status: 'sent', page: 1, limit: 1 }),
      CampaignRepository.getCampaigns({ status: 'scheduled', page: 1, limit: 1 }),
      CampaignRepository.getCampaigns({ status: 'draft', page: 1, limit: 1 }),
    ]);

    // Return array with properties attached for backwards & direct frontend compatibility
    const responseData: any = data;
    responseData.data = data;
    responseData.total = total;
    responseData.page = page;
    responseData.limit = limit;
    responseData.stats = {
      totalSent: sentRes.total,
      totalScheduled: schedRes.total,
      totalDrafts: draftRes.total,
    };

    res.json(responseData);
  } catch (error: any) {
    console.error('[campaignController] getCampaigns error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get scheduled campaigns
// @route   GET /api/notifications/campaigns/scheduled
// @access  Private/Admin
export const getScheduledCampaigns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data } = await CampaignRepository.getCampaigns({ status: 'scheduled', page: 1, limit: 100 });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send scheduled campaign immediately
// @route   POST /api/notifications/campaigns/:id/send-now
// @access  Private/Admin
export const sendCampaignNow = async (req: Request, res: Response): Promise<void> => {
  try {
    const campaign = await CampaignRepository.getCampaignById(req.params.id);
    if (!campaign) {
      res.status(404).json({ message: 'Campaign not found' });
      return;
    }
    await dispatchCampaignToEcosystem(campaign);
    await CampaignRepository.updateCampaign(campaign.id, {
      status: 'sent',
      sent_at: new Date(),
      delivered_count: campaign.recipients_count || 1,
    });
    res.json({ success: true, message: 'Campaign sent immediately' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Estimate audience count
// @route   GET or POST /api/notifications/campaigns/estimate
// @access  Private/Admin
export const estimateAudience = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawApp = (req.body?.app || req.query.app) as string;
    const app = rawApp === 'partner' ? 'provider' : (rawApp || 'customer');
    const audience_type = (req.body?.audience_type || req.query.audience || req.query.audience_type) as string;
    const filter = (req.body?.filter || req.query.filter) as string;
    const count = await CampaignRepository.estimateAudience(app, audience_type || 'all', filter);
    res.json({ estimated_recipients: count, count });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get quick test targets
// @route   GET /api/notifications/test-targets
// @access  Private/Admin
export const getTestTargets = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = req.query.role as string | undefined;
    const targets = await CampaignRepository.getTestTargets(role);
    res.json(targets);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update campaign / cancel scheduled
// @route   PUT /api/notifications/campaigns/:id
// @access  Private/Admin
export const updateCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.body.app === 'partner') {
      req.body.app = 'provider';
    }
    if (req.body.sound !== undefined) {
      const soundValidation = validateSoundIdentifier(req.body.sound);
      if (!soundValidation.valid) {
        res.status(400).json({ message: soundValidation.error });
        return;
      }
      req.body.sound = soundValidation.normalized;
    }
    if (req.body.type === 'CONTENT_UPDATE' || req.body.type === 'BANNER_UPDATE') {
      req.body.sound_enabled = false;
      req.body.sound = 'silent';
    }
    const campaign = await CampaignRepository.updateCampaign(req.params.id, req.body);
    if (!campaign) {
      res.status(404).json({ message: 'Campaign not found' });
      return;
    }
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete or cancel campaign
// @route   DELETE /api/notifications/campaigns/:id
// @access  Private/Admin
export const deleteCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await CampaignRepository.getCampaignById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: 'Campaign not found' });
      return;
    }

    if (existing.status === 'scheduled') {
      await CampaignRepository.cancelScheduledCampaign(req.params.id);
      res.json({ message: 'Scheduled campaign cancelled successfully' });
      return;
    }

    const success = await CampaignRepository.deleteCampaign(req.params.id);
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Track notification open event (analytics)
// @route   POST /api/notifications/track-open
// @access  Public / Authenticated
export const trackNotificationOpen = async (req: Request, res: Response): Promise<void> => {
  try {
    const { campaign_id, recipient_id } = req.body;
    if (!campaign_id) {
      res.status(400).json({ message: 'campaign_id is required' });
      return;
    }

    const userId = recipient_id || (req as any).user?.id || '00000000-0000-0000-0000-000000000000';
    await CampaignRepository.markDeliveryStatus(campaign_id, userId, 'opened');
    await CampaignRepository.syncCampaignCounters(campaign_id);

    res.json({ success: true, message: 'Notification open recorded' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register device FCM token
// @route   POST /api/notifications/register-token
// @access  Authenticated
export const registerDeviceToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token, device_type } = req.body;
    if (!token) {
      res.status(400).json({ message: 'FCM token is required' });
      return;
    }

    const userId = (req.user as any)?.id;
    const role = (req.user as any)?.role || 'customer';

    if (!userId) {
      res.status(401).json({ message: 'User authentication required' });
      return;
    }

    await CampaignRepository.registerDeviceToken(userId, role, token, device_type || 'android');
    res.json({ success: true, message: 'Device token registered successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── Templates ─────────────────────────────────────────────────────────

// @desc    Get templates
// @route   GET /api/notifications/templates
// @access  Private/Admin
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const app = req.query.app as string | undefined;
    const templates = await CampaignRepository.getTemplates(app);
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create template
// @route   POST /api/notifications/templates
// @access  Private/Admin
export const createTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await CampaignRepository.createTemplate(req.body);
    res.status(201).json(template);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update template
// @route   PUT /api/notifications/templates/:id
// @access  Private/Admin
export const updateTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await CampaignRepository.updateTemplate(req.params.id, req.body);
    if (!template) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete template
// @route   DELETE /api/notifications/templates/:id
// @access  Private/Admin
export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const success = await CampaignRepository.deleteTemplate(req.params.id);
    if (!success) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }
    res.json({ message: 'Template deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
