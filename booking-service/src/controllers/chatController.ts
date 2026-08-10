import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation';
import { ChatMessage } from '../models/ChatMessage';
import { Booking } from '../models/Booking';
import { sendSuccess, sendError, ErrorCodes } from '@bharatclap/shared';
import axios from 'axios';

const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

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

    const filter: any = {};
    if (bookingId) {
      filter.booking_id = bookingId;
    } else if (userId) {
      if (role === 'provider') {
        filter['provider.id'] = userId;
      } else {
        filter['customer.id'] = userId;
      }
    }

    const conversations = await Conversation.find(filter).sort({ last_message_at: -1 }).lean();
    sendSuccess(res, 200, 'Conversations retrieved', conversations);
  } catch (err) {
    next(err);
  }
};

export const getConversationMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    const [messages, total] = await Promise.all([
      ChatMessage.find({ conversation_id: conversationId })
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('conversation_id sender_id sender_name sender_role text status media idempotency_key createdAt')
        .lean(),
      ChatMessage.countDocuments({ conversation_id: conversationId }),
    ]);

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

    // Idempotency check
    if (idempotencyKey) {
      const existing = await ChatMessage.findOne({ idempotency_key: idempotencyKey }).lean();
      if (existing) {
        sendSuccess(res, 200, 'Message already sent (idempotent)', existing);
        return;
      }
    }

    let conversation = await Conversation.findOne({ conversation_id: conversationId });
    if (!conversation) {
      // Auto-create conversation if linked to a booking
      let bookingObj: any = null;
      if (bookingId || conversationId.startsWith('CHAT-BKG-')) {
        const bId = bookingId || conversationId.replace('CHAT-BKG-', '');
        bookingObj = await Booking.findOne({ $or: [{ _id: mongoose.Types.ObjectId.isValid(bId) ? bId : null }, { booking_id: bId }] }).lean();
      }

      conversation = await Conversation.create({
        conversation_id: conversationId,
        booking_id: bookingObj?.booking_id || bookingId,
        service_title: bookingObj?.service_name || 'Service Support',
        type: bookingObj ? 'booking' : (senderRole === 'provider' ? 'provider_support' : 'customer_support'),
        customer: {
          id: String(bookingObj?.customer_id || senderId),
          name: bookingObj?.customer_name || senderName,
          phone: bookingObj?.customer_phone || '+91 98765 43210',
        },
        provider: bookingObj?.provider_id ? {
          id: String(bookingObj.provider_id),
          name: bookingObj.provider_name || 'Assigned Provider',
          phone: bookingObj.provider_phone || '+91 91234 56789',
        } : undefined,
        status: 'active',
        last_message: text || '[Media Attachment]',
        last_message_at: new Date(),
        unread_count_customer: senderRole === 'customer' ? 0 : 1,
        unread_count_provider: senderRole === 'provider' ? 0 : 1,
        unread_count_admin: senderRole === 'admin' ? 0 : 1,
      });
    }

    const modResult = scanContentForModeration(text);

    const message = await ChatMessage.create({
      conversation_id: conversationId,
      sender_id: String(senderId),
      sender_name: senderName,
      sender_role: senderRole,
      text: text || '',
      media,
      is_intervention: senderRole === 'admin',
      status: 'delivered',
      moderation_flag: modResult.isFlagged ? { reason: modResult.reasons.join(', '), riskScore: modResult.riskScore } : undefined,
      idempotency_key: idempotencyKey,
    });

    // Update conversation state
    const now = new Date();
    conversation.last_message = senderRole === 'admin' ? `[ADMIN INTERVENTION] ${text}` : (text || '[Media Attachment]');
    conversation.last_message_at = now;
    if (senderRole !== 'customer') conversation.unread_count_customer += 1;
    if (senderRole !== 'provider') conversation.unread_count_provider += 1;
    if (senderRole !== 'admin') conversation.unread_count_admin += 1;

    if (modResult.isFlagged) {
      conversation.moderation.isFlagged = true;
      conversation.moderation.riskScore = Math.max(conversation.moderation.riskScore, modResult.riskScore);
      conversation.moderation.flaggedReasons = Array.from(new Set([...conversation.moderation.flaggedReasons, ...modResult.reasons]));
    }

    await conversation.save();

    // Emit real-time Socket events
    const socketPayload = {
      _id: message._id,
      id: message._id,
      conversation_id: conversationId,
      senderId: String(senderId),
      senderName,
      senderRole,
      text,
      media,
      timestamp: message.createdAt.toISOString(),
      status: 'delivered',
      isIntervention: senderRole === 'admin',
      moderationFlag: message.moderation_flag,
    };

    if (conversation.customer?.id) {
      emitSocketEvent(conversation.customer.id, 'new_chat_message', socketPayload);
    }
    if (conversation.provider?.id) {
      emitSocketEvent(conversation.provider.id, 'new_chat_message', socketPayload);
    }

    sendSuccess(res, 201, 'Message sent successfully', message);
  } catch (err) {
    next(err);
  }
};

export const markConversationRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user || {};
    const role = user.role || 'customer';

    const update: any = {};
    if (role === 'admin') update.unread_count_admin = 0;
    else if (role === 'provider') update.unread_count_provider = 0;
    else update.unread_count_customer = 0;

    await Promise.all([
      Conversation.updateOne({ conversation_id: conversationId }, { $set: update }),
      ChatMessage.updateMany({ conversation_id: conversationId }, { $set: { status: 'read' } }),
    ]);

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
    const { type, status, searchQuery, flaggedOnly } = req.query;

    const filter: any = {};
    if (type && type !== 'all') filter.type = type;
    if (status && status !== 'all') filter.status = status;
    if (flaggedOnly === 'true') filter['moderation.isFlagged'] = true;

    if (searchQuery) {
      const q = String(searchQuery).toLowerCase();
      filter.$or = [
        { conversation_id: { $regex: q, $options: 'i' } },
        { booking_id: { $regex: q, $options: 'i' } },
        { 'customer.name': { $regex: q, $options: 'i' } },
        { 'provider.name': { $regex: q, $options: 'i' } },
        { last_message: { $regex: q, $options: 'i' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ last_message_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    sendSuccess(res, 200, 'Admin conversations retrieved', { conversations, total, page, limit });
  } catch (err) {
    next(err);
  }
};

export const getAdminChatStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [activeCount, flaggedCount, resolvedCount, totalCount] = await Promise.all([
      Conversation.countDocuments({ status: 'active' }),
      Conversation.countDocuments({ $or: [{ status: 'flagged' }, { 'moderation.isFlagged': true }] }),
      Conversation.countDocuments({ status: 'resolved' }),
      Conversation.countDocuments(),
    ]);

    sendSuccess(res, 200, 'Chat statistics retrieved', {
      activeThreadsCount: activeCount,
      flaggedCount,
      resolvedCount,
      totalCount,
      slaStatus: flaggedCount > 5 ? 'WARNING' : 'PASS',
      avgFirstResponseSec: 45,
      avgResponseMin: '2m 10s',
      resolutionMin: '9m 32s',
      escalationsCount: flaggedCount,
    });
  } catch (err) {
    next(err);
  }
};

export const adminIntervene = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { message, adminName } = req.body;
    const adminUser = (req as any).user || {};
    const senderName = adminName || adminUser.name || 'Admin Support';

    if (!message?.trim()) {
      sendError(res, 400, 'Intervention message text required', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    let conversation = await Conversation.findOne({ conversation_id: conversationId });
    if (!conversation) {
      sendError(res, 404, 'Conversation not found', ErrorCodes.NOT_FOUND);
      return;
    }

    const chatMsg = await ChatMessage.create({
      conversation_id: conversationId,
      sender_id: String(adminUser._id || adminUser.id || 'admin_01'),
      sender_name: senderName,
      sender_role: 'admin',
      text: message,
      is_intervention: true,
      status: 'delivered',
    });

    const now = new Date();
    conversation.last_message = `[ADMIN INTERVENTION] ${message}`;
    conversation.last_message_at = now;
    conversation.unread_count_customer += 1;
    conversation.unread_count_provider += 1;
    await conversation.save();

    const payload = {
      _id: chatMsg._id,
      id: chatMsg._id,
      conversation_id: conversationId,
      senderId: String(adminUser._id || 'admin_01'),
      senderName,
      senderRole: 'admin',
      text: message,
      timestamp: now.toISOString(),
      status: 'delivered',
      isIntervention: true,
    };

    if (conversation.customer?.id) emitSocketEvent(conversation.customer.id, 'new_chat_message', payload);
    if (conversation.provider?.id) emitSocketEvent(conversation.provider.id, 'new_chat_message', payload);

    sendSuccess(res, 200, 'Admin intervention delivered successfully', chatMsg);
  } catch (err) {
    next(err);
  }
};

export const adminModerate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { action, note, messageId } = req.body; // action: 'flag' | 'unflag' | 'resolve' | 'delete_message'
    const adminUser = (req as any).user || {};

    const conversation = await Conversation.findOne({ conversation_id: conversationId });
    if (!conversation) {
      sendError(res, 404, 'Conversation not found', ErrorCodes.NOT_FOUND);
      return;
    }

    const now = new Date();
    if (action === 'flag') {
      conversation.status = 'flagged';
      conversation.moderation.isFlagged = true;
    } else if (action === 'unflag') {
      conversation.status = 'active';
      conversation.moderation.isFlagged = false;
    } else if (action === 'resolve') {
      conversation.status = 'resolved';
    }

    if (note) {
      conversation.moderation.notes.push(`${now.toISOString()} - ${adminUser.name || 'Admin'}: ${note}`);
    }
    conversation.moderation.reviewedBy = adminUser.name || 'Admin';
    conversation.moderation.reviewedAt = now;

    if (action === 'delete_message' && messageId) {
      await ChatMessage.updateOne(
        { _id: messageId, conversation_id: conversationId },
        { $set: { is_deleted: true, text: '[Message deleted by Admin Moderation]' } }
      );
    }

    await conversation.save();
    sendSuccess(res, 200, `Moderation action '${action}' completed successfully`, conversation);
  } catch (err) {
    next(err);
  }
};
