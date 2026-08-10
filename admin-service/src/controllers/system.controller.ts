import { Request, Response } from 'express';
import { SystemService } from '../services/system.service';

export class SystemController {
  static async getSystemOverview(req: Request, res: Response): Promise<void> {
    try {
      const data = await SystemService.getSystemOverview();
      res.status(200).json({
        success: true,
        message: 'System overview loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load system overview',
        errorCode: 'SYSTEM_ERROR',
        correlationId: (req as any).correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
