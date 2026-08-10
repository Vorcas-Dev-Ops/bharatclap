import { Request, Response } from 'express';
import { ReportsService } from '../services/reports.service';

export class ReportsController {
  static async getReports(req: Request, res: Response): Promise<void> {
    try {
      const type = (req.query.type as string) || 'revenue';
      const data = await ReportsService.getPrecomputedReport(type);

      res.status(200).json({
        success: true,
        message: `Report (${type}) loaded successfully`,
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load report',
        errorCode: 'REPORT_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
