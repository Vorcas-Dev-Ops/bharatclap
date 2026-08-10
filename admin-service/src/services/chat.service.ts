import { ChatClient } from '../clients/chat.client';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cacheKeys';
import { CacheTTL } from '../cache/cacheTTL';

export class ChatService {
  static async getChatDashboard() {
    const cacheKey = CacheKeys.chatDashboard();
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const stats = await ChatClient.getAdminChatStats();
    await CacheService.set(cacheKey, stats, CacheTTL.CHAT_DASHBOARD);
    return stats;
  }

  static async getAdminConversations(query: any) {
    return ChatClient.getAdminConversations(query);
  }

  static async interveneInConversation(conversationId: string, adminId: string, message: string, adminName?: string) {
    return ChatClient.adminIntervene(conversationId, message, adminName);
  }

  static async moderateConversation(conversationId: string, action: string, note?: string, messageId?: string) {
    return ChatClient.adminModerate(conversationId, action, note, messageId);
  }
}
