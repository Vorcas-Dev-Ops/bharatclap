import { Request, Response } from 'express';
import { PlatformSettings } from '../models/PlatformSettings';
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

    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = await PlatformSettings.create({
        platform_name: 'BHARATCLAP',
        support_email: 'support@bharatclap.com',
        platform_logo: '',
        support_phone: '+91 9876543210'
      });
    }
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
    let settings = await PlatformSettings.findOne();
    
    if (!settings) {
      settings = new PlatformSettings({ platform_name, support_email, platform_logo, support_phone });
    } else {
      if (platform_name !== undefined) settings.platform_name = platform_name;
      if (support_email !== undefined) settings.support_email = support_email;
      if (platform_logo !== undefined) settings.platform_logo = platform_logo;
      if (support_phone !== undefined) settings.support_phone = support_phone;
    }

    const updatedSettings = await settings.save();
    
    // Invalidate settings cache
    await deleteCache('catalog:settings');

    res.json(updatedSettings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
