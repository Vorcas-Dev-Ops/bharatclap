import axios from 'axios';
import { ENV } from '../config/env';

const headers = { 'x-internal-service-key': ENV.INTERNAL_SERVICE_KEY };

export class ChatClient {
  static async getAdminConversations(query: any) {
    try {
      const queryString = new URLSearchParams(query).toString();
      const res = await axios.get(`${ENV.BOOKING_SERVICE_URL}/api/admin/chat/conversations?${queryString}`, {
        headers,
        timeout: 5000,
      });
      return res.data?.data || { conversations: [], total: 0 };
    } catch (err: any) {
      console.warn('[CHAT CLIENT WARN] getAdminConversations error:', err?.message || err);
      return { conversations: [], total: 0 };
    }
  }

  static async getAdminChatStats() {
    try {
      const res = await axios.get(`${ENV.BOOKING_SERVICE_URL}/api/admin/chat/stats`, {
        headers,
        timeout: 5000,
      });
      return res.data?.data || {
        activeThreadsCount: 0,
        flaggedCount: 0,
        resolvedCount: 0,
        totalCount: 0,
        slaStatus: 'PASS',
      };
    } catch (err: any) {
      console.warn('[CHAT CLIENT WARN] getAdminChatStats error:', err?.message || err);
      return {
        activeThreadsCount: 0,
        flaggedCount: 0,
        resolvedCount: 0,
        totalCount: 0,
        slaStatus: 'PASS',
      };
    }
  }

  static async adminIntervene(conversationId: string, message: string, adminName?: string) {
    try {
      const res = await axios.post(
        `${ENV.BOOKING_SERVICE_URL}/api/admin/chat/${conversationId}/intervene`,
        { message, adminName },
        { headers, timeout: 5000 }
      );
      return res.data?.data;
    } catch (err: any) {
      throw new Error(err?.response?.data?.message || err?.message || 'Failed to intervene in conversation');
    }
  }

  static async adminModerate(conversationId: string, action: string, note?: string, messageId?: string) {
    try {
      const res = await axios.post(
        `${ENV.BOOKING_SERVICE_URL}/api/admin/chat/${conversationId}/moderate`,
        { action, note, messageId },
        { headers, timeout: 5000 }
      );
      return res.data?.data;
    } catch (err: any) {
      throw new Error(err?.response?.data?.message || err?.message || 'Failed to apply moderation action');
    }
  }
}
