import axios from 'axios';
import { logger } from '@bharatclap/shared';

export interface FcmPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
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

  public async sendPushNotification(payload: FcmPayload): Promise<boolean> {
    const { token, title, body, data = {} } = payload;

    if (!token) {
      logger.warn('FCM Push skipped: missing token', {
        service: 'notification-service',
        event: 'FCM_MISSING_TOKEN',
      });
      return false;
    }

    if (!this.isConfigured) {
      console.log(`[FCM PUSH MOCK] To: ${token.substring(0, 10)}... | Title: "${title}" | Body: "${body}"`);
      return true;
    }

    try {
      // Direct Legacy / HTTP v1 FCM API dispatch via axios
      const response = await axios.post(
        'https://fcm.googleapis.com/fcm/send',
        {
          to: token,
          notification: {
            title,
            body,
            sound: 'default',
            badge: '1',
          },
          data,
          priority: 'high',
        },
        {
          headers: {
            Authorization: `key=${this.serverKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      if (response.data?.success === 1) {
        logger.info('FCM Push Notification delivered successfully', {
          service: 'notification-service',
          event: 'FCM_PUSH_SUCCESS',
          metadata: { title, tokenPrefix: token.substring(0, 8) },
        });
        return true;
      } else {
        logger.warn('FCM Push Notification rejected by FCM', {
          service: 'notification-service',
          event: 'FCM_PUSH_REJECTED',
          metadata: { response: response.data },
        });
        return false;
      }
    } catch (err: any) {
      logger.error('Failed to send FCM Push Notification', err, {
        service: 'notification-service',
        event: 'FCM_PUSH_ERROR',
        metadata: { title, error: err.message },
      });
      return false;
    }
  }
}

export const fcmService = FcmService.getInstance();
