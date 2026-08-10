import { Request, Response } from 'express';
import { NocService } from '../services/noc.service';

export class NocController {
  static async getNocTelemetry(req: Request, res: Response): Promise<void> {
    try {
      const data = await NocService.getNocTelemetry();
      res.status(200).json({
        success: true,
        message: 'NOC telemetry loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load NOC telemetry',
        errorCode: 'NOC_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
