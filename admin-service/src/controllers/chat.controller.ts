import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';
import { AuditLogger } from '../logger/auditLogger';

export class ChatController {
  static async getChatDashboard(req: Request, res: Response): Promise<void> {
    try {
      const data = await ChatService.getChatDashboard();
      res.status(200).json({
        success: true,
        message: 'Chat Dashboard loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load Chat Dashboard',
        errorCode: 'CHAT_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const data = await ChatService.getAdminConversations(req.query);
      res.status(200).json({
        success: true,
        message: 'Conversations loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load conversations',
        errorCode: 'CHAT_CONVERSATIONS_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async intervene(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { message, adminName } = req.body;
      const adminId = (req as any).user?.id || 'admin_user';

      const data = await ChatService.interveneInConversation(conversationId, adminId, message, adminName);

      AuditLogger.log({
        adminId,
        action: 'CHAT_INTERVENE',
        resource: `Conversation:${conversationId}`,
        newValue: message,
        ip: req.ip || '127.0.0.1',
        browser: req.headers['user-agent'] || 'Browser',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`
      });

      res.status(200).json({
        success: true,
        message: 'Admin intervention sent successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to send admin intervention',
        errorCode: 'CHAT_INTERVENE_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async moderate(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { action, note, messageId } = req.body;
      const adminId = (req as any).user?.id || 'admin_user';

      const data = await ChatService.moderateConversation(conversationId, action, note, messageId);

      AuditLogger.log({
        adminId,
        action: `CHAT_MODERATE_${String(action).toUpperCase()}`,
        resource: `Conversation:${conversationId}`,
        newValue: note || action,
        ip: req.ip || '127.0.0.1',
        browser: req.headers['user-agent'] || 'Browser',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`
      });

      res.status(200).json({
        success: true,
        message: `Moderation action '${action}' applied successfully`,
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to apply moderation action',
        errorCode: 'CHAT_MODERATE_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
