import { Request, Response } from 'express';
import { Banner } from '../models/Banner';

// @desc    Get all banners
// @route   GET /api/banners
// @access  Public
export const getBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ensure any existing banners without a role field are set to 'user'
    await Banner.updateMany(
      { $or: [{ role: { $exists: false } }, { role: null }] },
      { $set: { role: 'user' } }
    );

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const roleQuery = req.query.role as string;

    const roleFilter = roleQuery === 'provider'
      ? { role: 'provider' }
      : roleQuery === 'user' || !roleQuery
        ? { $or: [{ role: 'user' }, { role: { $exists: false } }, { role: null }] }
        : {};

    const banners = await Banner.find({ status: 'active', isDeleted: { $ne: true }, ...roleFilter })
      .sort({ display_order: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const formattedBanners = banners.map(b => ({
      ...b,
      role: b.role || 'user'
    }));

    res.json(formattedBanners);
  } catch (error: any) {
    console.error('[bannerController] getBanners error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all banners (Admin)
// @route   GET /api/banners/admin
// @access  Private/Admin
export const getAllBannersAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ensure any existing banners without a role field are set to 'user'
    await Banner.updateMany(
      { $or: [{ role: { $exists: false } }, { role: null }] },
      { $set: { role: 'user' } }
    );

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;
    const roleQuery = req.query.role as string;

    const filter: any = { isDeleted: { $ne: true } };
    if (roleQuery === 'provider') {
      filter.role = 'provider';
    } else if (roleQuery === 'user') {
      filter.$or = [{ role: 'user' }, { role: { $exists: false } }, { role: null }];
    }

    const banners = await Banner.find(filter)
      .sort({ display_order: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const formattedBanners = banners.map(b => ({
      ...b,
      role: b.role || 'user'
    }));

    res.json(formattedBanners);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create banner
// @route   POST /api/banners
// @access  Private/Admin
export const createBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, subtitle, image_url, redirect_type, redirect_id, redirect_url, button_text, display_order, status, role = 'user' } = req.body;
    const banner = await Banner.create({ title, subtitle, image_url, redirect_type, redirect_id, redirect_url, button_text, display_order, status, role });
    res.status(201).json(banner);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update banner
// @route   PUT /api/banners/:id
// @access  Private/Admin
export const updateBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, subtitle, image_url, redirect_type, redirect_id, redirect_url, button_text, display_order, status, role } = req.body;
    const updateData: any = { title, subtitle, image_url, redirect_type, redirect_id, redirect_url, button_text, display_order, status };
    if (role !== undefined) {
      updateData.role = role;
    }
    const banner = await Banner.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!banner) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }
    res.json(banner);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete banner
// @route   DELETE /api/banners/:id
// @access  Private/Admin
export const deleteBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!banner) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }
    res.json({ message: 'Banner deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

