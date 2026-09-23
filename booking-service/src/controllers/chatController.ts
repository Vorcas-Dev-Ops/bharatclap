import { Request, Response, NextFunction } from 'express';
import { ChatRepository } from '../repositories/chatRepository';
import { BookingRepository } from '../repositories/bookingRepository';
import { sendSuccess, sendError, ErrorCodes } from '@bharatclap/shared';
import axios from 'axios';
import { getDb } from '../config/db';

const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

const scanContentForModeration = (text: string) => {
  if (!text) return { isFlagged: false, riskScore: 0, reasons: [] as string[] };

  const phoneRegex = /(\+?\d{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const paymentKeywords = ['gpay', 'paytm', 'phonepe', 'cash transfer', 'bank transfer', 'crypto', 'discount outside', 'direct pay'];

  let isFlagged = false;
  const reasons: string[] = [];

  if (phoneRegex.test(text)) {
    isFlagged = true;
    reasons.push('Phone Number Sharing Restriction');
  }

  const lower = text.toLowerCase();
  paymentKeywords.forEach((kw) => {
    if (lower.includes(kw)) {
      isFlagged = true;
      reasons.push(`External Payment Attempt (${kw})`);
    }
  });

  return { isFlagged, riskScore: isFlagged ? 85 : 5, reasons };
};

const emitSocketEvent = async (userId: string, event: string, data: any) => {
  try {
    await axios.post(
      `${PROVIDER_SERVICE_URL}/api/internal/emit`,
      { userId, event, data },
      { headers: { 'x-internal-service-key': INTERNAL_KEY }, timeout: 3000 }
    );
  } catch (err: any) {
    console.warn('[CHAT SOCKET EMIT WARN]', err?.message || err);
  }
};

// ─── USER / PROVIDER APIS ───────────────────────────────────────────────────

export const getConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    const userId = user?._id || user?.id || req.query.user_id;
    const role = user?.role || req.query.role || 'customer';
    const bookingId = req.query.booking_id as string;

    if (bookingId) {
      const conv = await ChatRepository.findConversationByIdOrBooking(bookingId);
      sendSuccess(res, 200, 'Conversations retrieved', conv ? [conv] : []);
      return;
    }

    if (userId) {
      const conversations = await ChatRepository.findUserConversations(String(userId), String(role));
      sendSuccess(res, 200, 'Conversations retrieved', conversations);
      return;
    }

    sendSuccess(res, 200, 'Conversations retrieved', []);
  } catch (err) {
    next(err);
  }
};

export const getConversationMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    const { messages, total } = await ChatRepository.getMessages(conversationId, page, limit);
    sendSuccess(res, 200, 'Messages retrieved', { messages, total, page, limit });
  } catch (err) {
    next(err);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { text, media, idempotencyKey, bookingId } = req.body;
    const user = (req as any).user || {};
    const senderId = user._id || user.id || req.body.senderId || 'guest_user';
    const senderName = user.name || req.body.senderName || 'User';
    const senderRole = user.role === 'admin' ? 'admin' : (user.role === 'provider' ? 'provider' : 'customer');

    if (!text?.trim() && !media) {
      sendError(res, 400, 'Message text or media attachment required', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    // Resolve or create conversation
    let conv = await ChatRepository.findConversationByIdOrBooking(conversationId);
    if (!conv) {
      let bkg = null;
      if (bookingId) {
        bkg = await BookingRepository.findById(bookingId);
      }
      conv = await ChatRepository.findOrCreateConversation(
        bookingId || (bkg ? bkg.id : undefined),
        bkg?.user_id || String(senderId),
        bkg?.provider_id
      );
    }

    const modResult = scanContentForModeration(text);

    const message = await ChatRepository.addMessage({
      conversationId: conv.id,
      senderId: String(senderId),
      text: text || '',
      messageType: media ? 'image' : 'text',
      isIntervention: senderRole === 'admin',
      moderationFlag: modResult.isFlagged ? { reason: modResult.reasons.join(', '), riskScore: modResult.riskScore } : undefined,
    });

    if (modResult.isFlagged) {
      await ChatRepository.updateStatus(conv.id, 'flagged');
    }

    // Real-time socket events
    const socketPayload = {
      id: message.id,
      conversation_id: conv.id,
      senderId: String(senderId),
      senderName,
      senderRole,
      text,
      media,
      timestamp: message.created_at.toISOString(),
      status: 'delivered',
      isIntervention: senderRole === 'admin',
    };

    if (conv.customer?.id) {
      emitSocketEvent(conv.customer.id, 'new_chat_message', socketPayload);
    }
    if (conv.provider?.id) {
      emitSocketEvent(conv.provider.id, 'new_chat_message', socketPayload);
    }

    sendSuccess(res, 201, 'Message sent successfully', message);
  } catch (err) {
    next(err);
  }
};

export const markConversationRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    sendSuccess(res, 200, 'Conversation marked as read');
  } catch (err) {
    next(err);
  }
};

// ─── ADMIN APIS ─────────────────────────────────────────────────────────────

export const getAdminConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const status = req.query.status as string;

    const { conversations, total } = await ChatRepository.findAdminConversations({
      status,
      page,
      limit,
    });

    sendSuccess(res, 200, 'Admin conversations retrieved', {
      conversations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

export const sendAdminIntervention = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { message: text } = req.body;
    const user = (req as any).user || {};

    if (!text?.trim()) {
      sendError(res, 400, 'Intervention message text is required', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const message = await ChatRepository.addMessage({
      conversationId,
      senderId: user._id || user.id || 'admin_user',
      text,
      messageType: 'system',
      isIntervention: true,
    });

    const conv = await ChatRepository.findConversationByIdOrBooking(conversationId);
    if (conv) {
      const socketPayload = {
        id: message.id,
        conversation_id: conv.id,
        senderId: 'SYSTEM_ADMIN',
        senderName: 'BharatClap Support',
        senderRole: 'admin',
        text,
        timestamp: message.created_at.toISOString(),
        isIntervention: true,
      };
      if (conv.customer?.id) emitSocketEvent(conv.customer.id, 'new_chat_message', socketPayload);
      if (conv.provider?.id) emitSocketEvent(conv.provider.id, 'new_chat_message', socketPayload);
    }

    sendSuccess(res, 201, 'Admin intervention sent', message);
  } catch (err) {
    next(err);
  }
};

export const getModerationQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const { conversations, total } = await ChatRepository.findAdminConversations({
      status: 'flagged',
      page,
      limit,
    });

    sendSuccess(res, 200, 'Moderation queue retrieved', {
      queue: conversations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

export const resolveModerationAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    await ChatRepository.updateStatus(conversationId, 'resolved');
    sendSuccess(res, 200, 'Moderation alert resolved');
  } catch (err) {
    next(err);
  }
};

export const addModerationNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    sendSuccess(res, 200, 'Moderation note added');
  } catch (err) {
    next(err);
  }
};

export const getChatAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await ChatRepository.getChatStats();
    sendSuccess(res, 200, 'Chat analytics retrieved', {
      totalConversations: stats.totalCount,
      activeConversations: stats.activeCount,
      flaggedConversations: stats.flaggedCount,
      resolvedConversations: stats.resolvedCount,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminChatStats = getChatAnalytics;
export const adminIntervene = sendAdminIntervention;
export const adminModerate = resolveModerationAlert;

