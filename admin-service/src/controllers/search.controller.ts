import { Request, Response } from 'express';
import { SearchService } from '../services/search.service';

export class SearchController {
  static async globalSearch(req: Request, res: Response): Promise<void> {
    try {
      const q = (req.query.q as string) || '';
      const data = await SearchService.globalSearch(q);

      res.status(200).json({
        success: true,
        message: 'Global search completed',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Search failed',
        errorCode: 'SEARCH_ERROR',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
