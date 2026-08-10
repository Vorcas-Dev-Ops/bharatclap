import express from 'express';
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  markConversationRead,
  getAdminConversations,
  getAdminChatStats,
  adminIntervene,
  adminModerate,
} from '../controllers/chatController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// User & Provider Chat Endpoints
router.get('/conversations', protect, getConversations);
router.get('/conversations/:conversationId/messages', protect, getConversationMessages);
router.post('/conversations/:conversationId/messages', protect, sendMessage);
router.put('/conversations/:conversationId/read', protect, markConversationRead);

// Admin Chat & Moderation Endpoints
router.get('/admin/conversations', protect, admin, getAdminConversations);
router.get('/admin/stats', protect, admin, getAdminChatStats);
router.post('/admin/:conversationId/intervene', protect, admin, adminIntervene);
router.post('/admin/:conversationId/moderate', protect, admin, adminModerate);

export default router;
