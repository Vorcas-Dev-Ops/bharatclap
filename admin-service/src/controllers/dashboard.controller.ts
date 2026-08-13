import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';

export class DashboardController {
  static async getDashboardMetrics(req: Request, res: Response): Promise<void> {
    try {
      const data = await DashboardService.getDashboardMetrics(req.query);
      res.status(200).json({
        success: true,
        message: 'Admin Dashboard metrics loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load Dashboard metrics',
        errorCode: 'DASHBOARD_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
