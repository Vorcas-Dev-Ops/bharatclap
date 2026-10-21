import axios from 'axios';
import { logger } from '@bharatclap/shared';

export interface FcmPayload {
  token: string;
  title?: string;
  body?: string;
  data?: Record<string, string>;
  isSilent?: boolean;
  channelId?: string;
  sound?: 'default' | 'job_alert' | 'booking' | 'silent' | string;
  soundEnabled?: boolean;
}

export interface FcmDispatchResult {
  success: boolean;
  messageId?: string;
  failureReason?: string;
  isInvalidToken?: boolean;
}

// ponytail: FCM Push Notification Service — fallback to dev log if credentials absent
export class FcmService {
  private static instance: FcmService;
  private isConfigured: boolean = false;
  private serverKey: string = '';

  private constructor() {
    this.serverKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY || '';
    this.isConfigured = !!this.serverKey;
    if (!this.isConfigured) {
      logger.info('FCM Push Service initialized in DEV/MOCK mode (FCM_SERVER_KEY not set).', {
        service: 'notification-service',
        event: 'FCM_INIT_DEV_MODE',
      });
    } else {
      logger.info('FCM Push Service initialized successfully in PRODUCTION mode.', {
        service: 'notification-service',
        event: 'FCM_INIT_PROD_MODE',
      });
    }
  }

  public static getInstance(): FcmService {
    if (!FcmService.instance) {
      FcmService.instance = new FcmService();
    }
    return FcmService.instance;
  }

  public async sendPushNotification(payload: FcmPayload): Promise<FcmDispatchResult> {
    const {
      token,
      title = '',
      body = '',
      data = {},
      isSilent = false,
      channelId,
      sound = 'default',
      soundEnabled = true,
    } = payload;

    if (!token) {
      logger.warn('FCM Push skipped: missing token', {
        service: 'notification-service',
        event: 'FCM_MISSING_TOKEN',
      });
      return { success: false, failureReason: 'Missing FCM token' };
    }

    const isSilentPush =
      isSilent ||
      sound === 'silent' ||
      !soundEnabled ||
      data.notification_type === 'CONTENT_UPDATE' ||
      data.notification_type === 'BANNER_UPDATE';

    // Map channels
    const resolvedChannel = isSilentPush
      ? 'bharatclap_silent'
      : channelId || data.channel_id || 'bharatclap_general';

    // Map sound file/name for native Android/iOS
    const resolvedSound =
      isSilentPush || !soundEnabled || sound === 'silent'
        ? undefined
        : sound === 'partner_job_alert' || sound === 'job_alert'
        ? 'partner_job_alert.mp3'
        : sound === 'bharatclap_alert' || sound === 'booking'
        ? (resolvedChannel === 'bharatclap_booking' ? 'booking_alert.mp3' : 'bharatclap_alert.mp3')
        : 'default';

    const enhancedData: Record<string, string> = {
      ...data,
      channel_id: resolvedChannel,
      sound: sound || 'default',
      sound_enabled: soundEnabled ? 'true' : 'false',
    };

    const iosSoundName = resolvedSound
      ? (resolvedSound === 'default' ? 'default' : `${resolvedSound.replace(/\.mp3$/, '')}.caf`)
      : undefined;

    if (!this.isConfigured) {
      console.log(
        `[FCM PUSH MOCK] Type: ${isSilentPush ? 'SILENT DATA' : 'VISIBLE'} | Android Channel: ${resolvedChannel} | Android Sound: ${resolvedSound || 'none'} | iOS APNS Sound: ${iosSoundName || 'none'} | To: ${token.substring(0, 15)}... | Title: "${title}" | Body: "${body}"`
      );
      return { success: true, messageId: `mock_msg_${Date.now()}` };
    }

    try {
      // Build RFC FCM body: for silent data updates, omit the notification block completely
      const fcmBody: Record<string, any> = {
        to: token,
        data: enhancedData,
        priority: isSilentPush ? 'normal' : 'high',
        content_available: true,
      };

      if (!isSilentPush && (title || body)) {
        fcmBody.notification = {
          title,
          body,
          sound: resolvedSound || 'default',
          badge: '1',
          android_channel_id: resolvedChannel,
        };

        fcmBody.android = {
          priority: 'high',
          notification: {
            channel_id: resolvedChannel,
            sound: resolvedSound || 'default',
            default_sound: resolvedSound === 'default',
          },
        };

        const iosSoundName = resolvedSound
          ? (resolvedSound === 'default' ? 'default' : `${resolvedSound.replace(/\.mp3$/, '')}.caf`)
          : undefined;

        fcmBody.apns = {
          payload: {
            aps: {
              sound: iosSoundName,
              badge: 1,
            },
          },
        };
      }

      const response = await axios.post(
        'https://fcm.googleapis.com/fcm/send',
        fcmBody,
        {
          headers: {
            Authorization: `key=${this.serverKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      const result = response.data?.results?.[0];
      const error = result?.error;

      if (response.data?.success === 1) {
        logger.info('FCM Push Notification delivered successfully', {
          service: 'notification-service',
          event: 'FCM_PUSH_SUCCESS',
          metadata: { title, tokenPrefix: token.substring(0, 8), isSilent: isSilentPush },
        });
        return { success: true, messageId: result?.message_id };
      } else {
        const isInvalid = error === 'NotRegistered' || error === 'InvalidRegistration';
        logger.warn('FCM Push Notification rejected by FCM', {
          service: 'notification-service',
          event: 'FCM_PUSH_REJECTED',
          metadata: { error, isInvalidToken: isInvalid },
        });
        return { success: false, failureReason: error || 'FCM rejected', isInvalidToken: isInvalid };
      }
    } catch (err: any) {
      logger.error('Failed to send FCM Push Notification', err, {
        service: 'notification-service',
        event: 'FCM_PUSH_ERROR',
        metadata: { title, error: err.message },
      });
      return { success: false, failureReason: err.message };
    }
  }
}

export const fcmService = FcmService.getInstance();
