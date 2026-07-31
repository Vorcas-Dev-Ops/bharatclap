import axios from 'axios';

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:5006';
const DEFAULT_INTERNAL_KEY = '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

const internalHeaders = () => {
  const key = process.env.INTERNAL_SERVICE_KEY || DEFAULT_INTERNAL_KEY;
  return { 'x-internal-service-key': key };
};

export const sendNotification = async (recipientId: string, title: string, message: string, type: string, metadata?: any) => {
  try {
    await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
      recipient_id: recipientId,
      recipient_type: 'User',
      title,
      message,
      type,
      metadata
    }, {
      headers: internalHeaders()
    });
  } catch (error: any) {
    console.error('[INTERNAL API] sendNotification failed:', error.message);
  }
};

export const sendProviderNotification = async (recipientId: string, title: string, message: string, type: string, metadata?: any) => {
  try {
    await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
      recipient_id: recipientId,
      recipient_type: 'Provider',
      title,
      message,
      type,
      metadata
    }, {
      headers: internalHeaders()
    });
  } catch (error: any) {
    console.error('[INTERNAL API] sendProviderNotification failed:', error.message);
  }
};
