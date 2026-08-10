import { Request, Response } from 'express';
import { FeatureFlagsService } from '../services/featureFlags.service';
import { AuditLogger } from '../logger/auditLogger';

export class FeatureFlagsController {
  static async getFlags(req: Request, res: Response): Promise<void> {
    try {
      const data = await FeatureFlagsService.getFeatureFlags();
      res.status(200).json({
        success: true,
        message: 'Feature flags loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load feature flags',
        errorCode: 'FEATURE_FLAGS_ERROR',
        correlationId: (req as any).correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async toggleFlag(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const { enabled } = req.body;

      const data = await FeatureFlagsService.toggleFeatureFlag(key, Boolean(enabled));

      AuditLogger.log({
        adminId: (req as any).user?.id || 'admin_user',
        action: 'TOGGLE_FEATURE_FLAG',
        resource: `FeatureFlag:${key}`,
        newValue: { enabled },
        ip: req.ip || '127.0.0.1',
        browser: (req.headers['user-agent'] as string) || 'Browser',
        correlationId: (req as any).correlationId
      });

      res.status(200).json({
        success: true,
        message: `Feature flag [${key}] updated to ${enabled}`,
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to toggle feature flag',
        errorCode: 'FEATURE_FLAG_TOGGLE_ERROR',
        correlationId: (req as any).correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
