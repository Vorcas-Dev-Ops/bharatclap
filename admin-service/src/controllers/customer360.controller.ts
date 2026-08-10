import { Request, Response } from 'express';
import { Customer360Service } from '../services/customer360.service';
import { AuditLogger } from '../logger/auditLogger';

export class Customer360Controller {
  static async getCustomer360(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = await Customer360Service.getCustomer360(id);

      AuditLogger.log({
        adminId: (req as any).user?.id || 'admin_user',
        action: 'VIEW_CUSTOMER_360',
        resource: `Customer:${id}`,
        ip: req.ip || '127.0.0.1',
        browser: req.headers['user-agent'] || 'Browser',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`
      });

      res.status(200).json({
        success: true,
        message: 'Customer 360 loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load Customer 360 data',
        errorCode: 'CUSTOMER_360_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
