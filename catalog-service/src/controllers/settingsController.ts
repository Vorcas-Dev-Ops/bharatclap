import { cleanOrphanedImages } from '../utils/imageStorage';
import { Request, Response } from 'express';
import { SettingsRepository } from '../repositories/settingsRepository';
import { getCache, setCache, deleteCache } from '../config/redis';

// @desc    Get platform settings
// @route   GET /api/settings
// @access  Public
export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'catalog:settings';
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const settings = await SettingsRepository.getPlatformSettings();
    await setCache(cacheKey, settings, 3600); // 1 hour TTL
    res.json(settings);
  } catch (error: any) {
    console.error('[settingsController] getSettings error:', error.message);
    res.json({
      platform_name: 'BHARATCLAP',
      support_email: 'support@bharatclap.com',
      platform_logo: '',
      support_phone: '+91 9876543210'
    });
  }
};

// @desc    Update platform settings
// @route   PUT /api/settings
// @access  Private/Admin
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform_name, support_email, platform_logo, support_phone } = req.body;
    const updatedSettings = await SettingsRepository.updatePlatformSettings({
      platform_name,
      support_email,
      platform_logo,
      support_phone,
    });

    // Invalidate settings cache
    await deleteCache('catalog:settings');

    res.json(updatedSettings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Trigger orphan images cleanup
// @route   POST /api/settings/clean-orphan-images
// @access  Private/Admin
export const triggerOrphanImagesCleanup = async (req: Request, res: Response): Promise<void> => {
  try {
    const graceHours = req.body && req.body.grace_period_hours !== undefined ? Number(req.body.grace_period_hours) : 24;
    const stats = await cleanOrphanedImages(graceHours);
    res.json({ success: true, ...stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
