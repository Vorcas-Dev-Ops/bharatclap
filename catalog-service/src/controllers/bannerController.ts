import { Request, Response } from 'express';
import { BannerRepository } from '../repositories/bannerRepository';
import { AuthRequest } from '../middleware/authMiddleware';
import { invalidateBannerCache } from '../utils/cacheManager';
import { processAndStoreImage, deleteStoredImage } from '../utils/imageStorage';

// @desc    Get all active banners (Public / Customers / Providers)
// @route   GET /api/banners
// @access  Public
export const getBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const audienceQuery = (req.query.audience || req.query.role || 'user') as string;
    const placementQuery = req.query.placement as string | undefined;

    const banners = await BannerRepository.findWithFilters({
      audience: audienceQuery,
      placement: placementQuery,
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

// @desc    Get all banners with full admin filtering
// @route   GET /api/banners/admin
// @access  Private/Admin
export const getAllBannersAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;
    const audienceQuery = (req.query.audience || req.query.role) as string | undefined;
    const placementQuery = req.query.placement as string | undefined;
    const statusQuery = req.query.status as string | undefined;

    const banners = await BannerRepository.findWithFilters({
      audience: audienceQuery,
      placement: placementQuery,
      status: statusQuery,
      activeOnly: false,
      page,
      limit,
    });

    res.json(banners);
  } catch (error: any) {
    console.error('[bannerController] getAllBannersAdmin error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create banner
// @route   POST /api/banners
// @access  Private/Admin
export const createBanner = async (req: Request, res: Response): Promise<void> => {
  let processedUrl: string | undefined = req.body.image_url;
  let isNewUpload = false;

  try {
    if (typeof req.body.image_url === 'string' && req.body.image_url.startsWith('data:image/')) {
      const slug = req.body.title || req.body.audience || 'banner';
      processedUrl = await processAndStoreImage(req.body.image_url, 'banners', slug);
      isNewUpload = true;
    }

    try {
      const banner = await BannerRepository.create({
        ...req.body,
        image_url: processedUrl,
      });
      await invalidateBannerCache();
      res.status(201).json(banner);
    } catch (dbErr: any) {
      if (isNewUpload && processedUrl) {
        deleteStoredImage(processedUrl).catch(() => {});
      }
      throw dbErr;
    }
  } catch (error: any) {
    console.error('[bannerController] createBanner error:', error.message);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update banner
// @route   PUT /api/banners/:id
// @access  Private/Admin
export const updateBanner = async (req: Request, res: Response): Promise<void> => {
  let processedUrl: string | undefined = req.body.image_url;
  let isNewUpload = false;

  try {
    const existing = await BannerRepository.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }

    const oldImage = existing.image_url;

    if (typeof req.body.image_url === 'string' && req.body.image_url.startsWith('data:image/')) {
      const slug = req.body.title || existing.title || 'banner';
      processedUrl = await processAndStoreImage(req.body.image_url, 'banners', slug);
      isNewUpload = true;
    }

    try {
      const banner = await BannerRepository.update(req.params.id, {
        ...req.body,
        image_url: processedUrl !== undefined ? processedUrl : existing.image_url,
      });

      if (!banner) {
        res.status(404).json({ message: 'Banner not found' });
        return;
      }

      await invalidateBannerCache();

      // Best effort cleanup of old image after DB update confirmed
      if (isNewUpload && oldImage && processedUrl !== oldImage) {
        deleteStoredImage(oldImage).catch((err) => {
          console.warn('[BANNER UPDATE] Old image cleanup warning:', err?.message);
        });
      }

      res.json(banner);
    } catch (dbErr: any) {
      if (isNewUpload && processedUrl) {
        deleteStoredImage(processedUrl).catch(() => {});
      }
      throw dbErr;
    }
  } catch (error: any) {
    console.error('[bannerController] updateBanner error:', error.message);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Reorder banners
// @route   PUT /api/banners/reorder
// @access  Private/Admin
export const reorderBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ message: 'items array is required for reordering' });
      return;
    }
    await BannerRepository.reorder(items);
    await invalidateBannerCache();
    res.json({ message: 'Banners reordered successfully' });
  } catch (error: any) {
    console.error('[bannerController] reorderBanners error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete banner
// @route   DELETE /api/banners/:id
// @access  Private/Admin
export const deleteBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await BannerRepository.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }

    const permanent = req.query.permanent === 'true';
    const success = permanent
      ? await BannerRepository.delete(req.params.id)
      : await BannerRepository.softDelete(req.params.id);

    if (!success) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }

    await invalidateBannerCache();

    // Clean up stored image asynchronously (best effort)
    if (existing.image_url) {
      deleteStoredImage(existing.image_url).catch((err) => {
        console.warn('[BANNER DELETE] Image cleanup warning:', err?.message);
      });
    }

    res.json({ message: 'Banner deleted' });
  } catch (error: any) {
    console.error('[bannerController] deleteBanner error:', error.message);
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
      audience: 'provider',
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
