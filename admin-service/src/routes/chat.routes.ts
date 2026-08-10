import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { requirePermission } from '../middlewares/permissionMiddleware';
import { AdminPermission } from '../types/permissions';

const router = Router();

// GET /api/v1/admin/chat/dashboard
router.get('/dashboard', requirePermission(AdminPermission.CHAT_VIEW), ChatController.getChatDashboard);

// GET /api/v1/admin/chat/conversations
router.get('/conversations', requirePermission(AdminPermission.CHAT_VIEW), ChatController.getConversations);

// POST /api/v1/admin/chat/:conversationId/intervene
router.post('/:conversationId/intervene', requirePermission(AdminPermission.CHAT_INTERVENE), ChatController.intervene);

// POST /api/v1/admin/chat/:conversationId/moderate
router.post('/:conversationId/moderate', requirePermission(AdminPermission.CHAT_MODERATE), ChatController.moderate);

export default router;
