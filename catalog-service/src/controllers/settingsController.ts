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
    const { platform_name, support_email } = req.body;
    let settings = await PlatformSettings.findOne();
    
    if (!settings) {
      settings = new PlatformSettings({ platform_name, support_email });
    } else {
      if (platform_name !== undefined) settings.platform_name = platform_name;
      if (support_email !== undefined) settings.support_email = support_email;
    }

    const updatedSettings = await settings.save();
    res.json(updatedSettings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
