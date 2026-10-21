import express from 'express';
import {
  getBanners,
  getAllBannersAdmin,
  createBanner,
  updateBanner,
  deleteBanner,
  getMyProviderBanners,
  reorderBanners,
} from '../controllers/bannerController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(getBanners)
  .post(protect, admin, createBanner);

router.get('/admin', protect, admin, getAllBannersAdmin);
router.put('/reorder', protect, admin, reorderBanners);
router.get('/provider/me', protect, getMyProviderBanners);

router.route('/:id')
  .put(protect, admin, updateBanner)
  .delete(protect, admin, deleteBanner);

export default router;
