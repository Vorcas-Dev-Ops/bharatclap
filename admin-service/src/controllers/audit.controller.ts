import { Request, Response } from 'express';
import { AuditService } from '../services/audit.service';

export class AuditController {
  static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const data = await AuditService.getAuditLogs();
      res.status(200).json({
        success: true,
        message: 'Audit logs loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load audit logs',
        errorCode: 'AUDIT_ERROR',
        correlationId: (req as any).correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
