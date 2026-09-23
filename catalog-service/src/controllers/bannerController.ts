import { Request, Response } from 'express';
import { BannerRepository } from '../repositories/bannerRepository';
import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Get all banners
// @route   GET /api/banners
// @access  Public
export const getBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const roleQuery = req.query.role as string;

    const banners = await BannerRepository.findWithFilters({
      role: roleQuery || 'user',
      activeOnly: true,
      page,
      limit,
    });

    res.json(banners);
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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;
    const roleQuery = req.query.role as string;

    const banners = await BannerRepository.findWithFilters({
      role: roleQuery || 'user',
      activeOnly: false,
      page,
      limit,
    });

    res.json(banners);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create banner
// @route   POST /api/banners
// @access  Private/Admin
export const createBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const banner = await BannerRepository.create(req.body);
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
    const banner = await BannerRepository.update(req.params.id, req.body);
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
    const success = await BannerRepository.softDelete(req.params.id);
    if (!success) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }
    res.json({ message: 'Banner deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get banners for the logged in provider
// @route   GET /api/banners/provider/me
// @access  Private/Provider
export const getMyProviderBanners = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'provider') {
      res.status(403).json({ message: 'Access denied. Only providers can view provider banners.' });
      return;
    }

    const banners = await BannerRepository.findWithFilters({
      role: 'provider',
      activeOnly: true,
      page: 1,
      limit: 50,
    });

    res.json(banners);
  } catch (error: any) {
    console.error('[bannerController] getMyProviderBanners error:', error.message);
    res.status(500).json({ message: error.message });
  }
};
