import { Router, Request, Response, NextFunction } from 'express';
import { SystemLog } from '../models/SystemLog';
import { internalAuth } from '../middleware/internalAuth';

const router = Router();

// Protect internal log routes with constant-time environment key validation
router.use(internalAuth);


/**
 * GET /internal/logs
 * Query params: category, level, limit, page, from, to, service
 * Protected by x-internal-service-key (caller must add middleware).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      level,
      limit: rawLimit,
      page: rawPage,
      from,
      to,
      service,
    } = req.query;

    const limit = Math.min(parseInt(rawLimit as string, 10) || 50, 200);
    const page = Math.max(parseInt(rawPage as string, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (service) filter.service = service;
    if (from || to) {
      filter.created_at = {};
      if (from) filter.created_at.$gte = new Date(from as string);
      if (to) filter.created_at.$lte = new Date(to as string);
    }

    const [logs, total] = await Promise.all([
      SystemLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      SystemLog.countDocuments(filter),
    ]);

    res.json({ success: true, data: logs, total, page, limit });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to query logs' });
  }
});

export { router as logRoutes };
