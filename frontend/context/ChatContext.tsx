"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/config/api';
import { getSocket } from '@/services/socket';

export type MediaAttachment = {
  type: 'image' | 'pdf' | 'voice' | 'location' | 'booking_photo' | 'completion_photo';
  url: string;
  name?: string;
  size?: string;
  duration?: string;
  latLng?: { lat: number; lng: number; address: string };
};

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'retrying';

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'provider' | 'admin';
  text: string;
  timestamp: string;
  status: MessageStatus;
  media?: MediaAttachment;
  isIntervention?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  moderationFlag?: {
    reason: string;
    riskScore: number;
  };
};

export type ChatTimelineEvent = {
  id: string;
  title: string;
  timestamp: string;
  type: 'booking_created' | 'provider_assigned' | 'provider_accepted' | 'provider_reached' | 'otp_verified' | 'service_completed' | 'rated';
  details?: string;
};

export type ChatAuditLogEntry = {
  id: string;
  timestamp: string;
  action: 'message_edited' | 'message_deleted' | 'admin_intervention' | 'broadcast_sent' | 'moderation_flagged';
  actor: string;
  details: string;
  correlationId: string;
};

export type PresenceStatus = 'online' | 'offline' | 'busy' | 'on_booking';

export type ChatThread = {
  id: string;
  bookingId?: string;
  serviceTitle?: string;
  type: 'booking' | 'customer_support' | 'provider_support';
  customer: {
    id: string;
    name: string;
    phone: string;
    avatar?: string;
    presence: PresenceStatus;
    lastSeen: string;
  };
  provider?: {
    id: string;
    name: string;
    phone: string;
    avatar?: string;
    serviceCategory?: string;
    presence: PresenceStatus;
    lastSeen: string;
  };
  status: 'active' | 'resolved' | 'flagged';
  lastMessage: string;
  lastMessageTime: string;
  unreadCountCustomer: number;
  unreadCountProvider: number;
  unreadCountAdmin: number;
  isTypingCustomer: boolean;
  isTypingProvider: boolean;
  sla: {
    firstResponseSec: number;
    avgResponseMin: string;
    resolutionMin: string;
    escalations: number;
    status: 'PASS' | 'FAIL' | 'WARNING';
  };
  moderation: {
    isFlagged: boolean;
    riskScore: number;
    flaggedReasons: string[];
  };
  timelineEvents: ChatTimelineEvent[];
  auditLogs: ChatAuditLogEntry[];
  messages: ChatMessage[];
};

interface ChatContextType {
  threads: ChatThread[];
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  isLoading: boolean;
  fetchThreads: () => Promise<void>;
  sendMessage: (
    threadId: string,
    text: string,
    senderRole: 'customer' | 'provider' | 'admin',
    senderName: string,
    senderId: string,
    media?: MediaAttachment,
    isIntervention?: boolean
  ) => Promise<void>;
  retryMessage: (threadId: string, messageId: string) => void;
  deleteMessage: (threadId: string, messageId: string) => Promise<void>;
  resolveThread: (threadId: string) => Promise<void>;
  flagThread: (threadId: string) => Promise<void>;
  exportChat: (threadId: string, format: 'pdf' | 'csv' | 'txt') => void;
  isWidgetOpen: boolean;
  setIsWidgetOpen: (open: boolean) => void;
  widgetRole: 'customer' | 'provider' | 'admin';
  setWidgetRole: (role: 'customer' | 'provider' | 'admin') => void;
  openChatWith: (bookingId?: string, customerId?: string, providerId?: string, role?: 'customer' | 'provider' | 'admin') => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const transformApiConversation = (c: any): ChatThread => {
  const lastTime = c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
  return {
    id: c.conversation_id || c._id,
    bookingId: c.booking_id,
    serviceTitle: c.service_title || 'Service Support',
    type: c.type || 'booking',
    customer: {
      id: c.customer?.id || 'cust_user',
      name: c.customer?.name || 'Customer',
      phone: c.customer?.phone || '+91 98765 43210',
      avatar: c.customer?.avatar,
      presence: c.customer?.presence || 'online',
      lastSeen: 'Active now',
    },
    provider: c.provider ? {
      id: c.provider.id,
      name: c.provider.name || 'Provider',
      phone: c.provider.phone || '+91 91234 56789',
      avatar: c.provider.avatar,
      serviceCategory: c.provider.serviceCategory || 'Service Partner',
      presence: c.provider.presence || 'online',
      lastSeen: 'On duty',
    } : undefined,
    status: c.status || 'active',
    lastMessage: c.last_message || '',
    lastMessageTime: lastTime,
    unreadCountCustomer: c.unread_count_customer || 0,
    unreadCountProvider: c.unread_count_provider || 0,
    unreadCountAdmin: c.unread_count_admin || 0,
    isTypingCustomer: false,
    isTypingProvider: false,
    sla: {
      firstResponseSec: 45,
      avgResponseMin: '2m 10s',
      resolutionMin: '9m 32s',
      escalations: c.moderation?.isFlagged ? 1 : 0,
      status: c.moderation?.isFlagged ? 'WARNING' : 'PASS',
    },
    moderation: {
      isFlagged: c.moderation?.isFlagged || false,
      riskScore: c.moderation?.riskScore || 0,
      flaggedReasons: c.moderation?.flaggedReasons || [],
    },
    timelineEvents: [],
    auditLogs: [],
    messages: [],
  };
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [widgetRole, setWidgetRole] = useState<'customer' | 'provider' | 'admin'>('customer');

  const fetchThreads = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try admin endpoint first, fall back to user endpoint
      let res = await apiClient.get('/v1/admin/chat/conversations').catch(() => null);
      if (!res?.data?.data?.conversations) {
        res = await apiClient.get('/chat/conversations').catch(() => null);
      }

      const list = res?.data?.data?.conversations || res?.data?.data || [];
      if (Array.isArray(list) && list.length > 0) {
        const transformed = list.map(transformApiConversation);
        setThreads(transformed);
        if (!activeThreadId) {
          setActiveThreadId(transformed[0].id);
        }
      } else {
        setThreads([]);
      }
    } catch (err) {
      console.warn('[ChatContext] Failed to load threads:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeThreadId]);

  // Load message history for active thread
  const fetchMessagesForThread = useCallback(async (threadId: string) => {
    try {
      const res = await apiClient.get(`/chat/conversations/${threadId}/messages`);
      const msgList = res?.data?.data?.messages || [];
      if (Array.isArray(msgList)) {
        const mappedMessages: ChatMessage[] = msgList.map((m: any) => ({
          id: m._id || m.id,
          senderId: m.sender_id || m.senderId,
          senderName: m.sender_name || m.senderName,
          senderRole: m.sender_role || m.senderRole,
          text: m.text,
          timestamp: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
          status: m.status || 'delivered',
          media: m.media,
          isIntervention: m.is_intervention || m.isIntervention,
          isDeleted: m.is_deleted || m.isDeleted,
          moderationFlag: m.moderation_flag || m.moderationFlag,
        }));

        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, messages: mappedMessages } : t))
        );
      }
    } catch (err) {
      console.warn(`[ChatContext] Failed to fetch messages for thread ${threadId}:`, err);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    if (activeThreadId) {
      fetchMessagesForThread(activeThreadId);
    }
  }, [activeThreadId, fetchMessagesForThread]);

  // Connect Socket.io real-time listener
  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    const handleNewMessage = (msg: any) => {
      if (!msg?.conversation_id) return;
      const newMsg: ChatMessage = {
        id: msg._id || msg.id || `msg_${Date.now()}`,
        senderId: msg.senderId || msg.sender_id,
        senderName: msg.senderName || msg.sender_name || 'User',
        senderRole: msg.senderRole || msg.sender_role || 'customer',
        text: msg.text || '',
        timestamp: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered',
        media: msg.media,
        isIntervention: msg.isIntervention,
        moderationFlag: msg.moderationFlag,
      };

      setThreads((prev) => {
        const threadIndex = prev.findIndex((t) => t.id === msg.conversation_id);
        if (threadIndex !== -1) {
          const updated = [...prev];
          const target = updated[threadIndex];
          const exists = target.messages.some((m) => m.id === newMsg.id);
          if (!exists) {
            updated[threadIndex] = {
              ...target,
              lastMessage: msg.text || '[Media Attachment]',
              lastMessageTime: newMsg.timestamp,
              messages: [...target.messages, newMsg],
            };
          }
          return updated;
        } else {
          // Refresh thread list if new conversation received
          fetchThreads();
          return prev;
        }
      });
    };

    socket.on('new_chat_message', handleNewMessage);
    return () => {
      socket.off('new_chat_message', handleNewMessage);
    };
  }, [fetchThreads]);

  const sendMessage = async (
    threadId: string,
    text: string,
    senderRole: 'customer' | 'provider' | 'admin',
    senderName: string,
    senderId: string,
    media?: MediaAttachment,
    isIntervention: boolean = false
  ) => {
    if (!text.trim() && !media) return;

    try {
      const payload = {
        text,
        media,
        idempotencyKey: `msg_idemp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        bookingId: threads.find((t) => t.id === threadId)?.bookingId,
        senderName,
        senderId,
      };

      const endpoint = isIntervention || senderRole === 'admin'
        ? `/v1/admin/chat/${threadId}/intervene`
        : `/chat/conversations/${threadId}/messages`;

      const res = await apiClient.post(endpoint, isIntervention || senderRole === 'admin' ? { message: text, adminName: senderName } : payload);

      if (res?.data?.data) {
        fetchMessagesForThread(threadId);
      }
    } catch (err) {
      console.warn('[ChatContext] Send message failed:', err);
    }
  };

  const retryMessage = (threadId: string, messageId: string) => {
    fetchMessagesForThread(threadId);
  };

  const deleteMessage = async (threadId: string, messageId: string) => {
    try {
      await apiClient.post(`/v1/admin/chat/${threadId}/moderate`, {
        action: 'delete_message',
        messageId,
      });
      fetchMessagesForThread(threadId);
    } catch (err) {
      console.warn('[ChatContext] Delete message failed:', err);
    }
  };

  const resolveThread = async (threadId: string) => {
    try {
      await apiClient.post(`/v1/admin/chat/${threadId}/moderate`, { action: 'resolve' });
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, status: 'resolved' } : t))
      );
    } catch (err) {
      console.warn('[ChatContext] Resolve thread failed:', err);
    }
  };

  const flagThread = async (threadId: string) => {
    try {
      await apiClient.post(`/v1/admin/chat/${threadId}/moderate`, { action: 'flag' });
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, status: 'flagged' } : t))
      );
    } catch (err) {
      console.warn('[ChatContext] Flag thread failed:', err);
    }
  };

  const exportChat = (threadId: string, format: 'pdf' | 'csv' | 'txt') => {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    let content = `BHARATCLAP ENTERPRISE CHAT EXPORT\n`;
    content += `Thread ID: ${thread.id} | Booking ID: ${thread.bookingId || 'N/A'}\n`;
    content += `Customer: ${thread.customer.name} | Provider: ${thread.provider?.name || 'N/A'}\n`;
    content += `Export Date: ${new Date().toLocaleString()}\n`;
    content += `--------------------------------------------------\n\n`;

    thread.messages.forEach((m) => {
      content += `[${m.timestamp}] ${m.senderName} (${m.senderRole.toUpperCase()}): ${m.text}\n`;
      if (m.media) content += `   [Attachment: ${m.media.type} - ${m.media.url || m.media.name}]\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thread.id}_transcript.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openChatWith = (bookingId?: string, customerId?: string, providerId?: string, role: 'customer' | 'provider' | 'admin' = 'customer') => {
    setWidgetRole(role);
    setIsWidgetOpen(true);
    if (bookingId) {
      const match = threads.find((t) => t.bookingId === bookingId);
      if (match) {
        setActiveThreadId(match.id);
      }
    }
  };

  return (
    <ChatContext.Provider
      value={{
        threads,
        activeThreadId,
        setActiveThreadId,
        isLoading,
        fetchThreads,
        sendMessage,
        retryMessage,
        deleteMessage,
        resolveThread,
        flagThread,
        exportChat,
        isWidgetOpen,
        setIsWidgetOpen,
        widgetRole,
        setWidgetRole,
        openChatWith,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
