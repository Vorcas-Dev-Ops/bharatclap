import { Request, Response } from 'express';
import { PlatformSettings } from '../models/PlatformSettings';

// @desc    Get platform settings
// @route   GET /api/settings
// @access  Public
export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = await PlatformSettings.create({});
    }
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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
    res.json(updatedSettings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
