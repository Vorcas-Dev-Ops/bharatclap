import { Request, Response } from 'express';
import { FinanceService } from '../services/finance.service';

export class FinanceController {
  static async getFinanceDashboard(req: Request, res: Response): Promise<void> {
    try {
      const data = await FinanceService.getFinanceMetrics();
      res.status(200).json({
        success: true,
        message: 'Finance Dashboard metrics loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load Finance metrics',
        errorCode: 'FINANCE_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
