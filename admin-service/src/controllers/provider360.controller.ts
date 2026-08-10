import { Request, Response } from 'express';
import { Provider360Service } from '../services/provider360.service';
import { AuditLogger } from '../logger/auditLogger';

export class Provider360Controller {
  static async getProvider360(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = await Provider360Service.getProvider360(id);

      AuditLogger.log({
        adminId: (req as any).user?.id || 'admin_user',
        action: 'VIEW_PROVIDER_360',
        resource: `Provider:${id}`,
        ip: req.ip || '127.0.0.1',
        browser: req.headers['user-agent'] || 'Browser',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`
      });

      res.status(200).json({
        success: true,
        message: 'Provider 360 loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load Provider 360 data',
        errorCode: 'PROVIDER_360_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
