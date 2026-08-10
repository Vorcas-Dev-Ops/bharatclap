import { Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { AuditLogger } from '../logger/auditLogger';

export class SettingsController {
  static async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const data = await SettingsService.getPlatformSettings();
      res.status(200).json({
        success: true,
        message: 'Platform settings loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load settings',
        errorCode: 'SETTINGS_ERROR',
        correlationId: (req as any).correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async getPublicSettings(req: Request, res: Response): Promise<void> {
    try {
      const data = await SettingsService.getPublicSettings();
      res.status(200).json({
        success: true,
        message: 'Public platform settings loaded successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to load public settings',
        errorCode: 'PUBLIC_SETTINGS_ERROR',
        correlationId: (req as any).correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const newSettings = req.body;
      const data = await SettingsService.updatePlatformSettings(newSettings);

      AuditLogger.log({
        adminId: (req as any).user?.id || 'admin_user',
        action: 'UPDATE_SETTINGS',
        resource: 'PlatformSettings',
        newValue: newSettings,
        ip: req.ip || '127.0.0.1',
        browser: (req.headers['user-agent'] as string) || 'Browser',
        correlationId: (req as any).correlationId
      });

      res.status(200).json({
        success: true,
        message: 'Platform settings updated successfully',
        timestamp: new Date().toISOString(),
        correlationId: (req as any).correlationId,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to update settings',
        errorCode: 'SETTINGS_UPDATE_ERROR',
        correlationId: (req as any).correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
