import express from 'express';
import { getSettings, updateSettings, triggerOrphanImagesCleanup } from '../controllers/settingsController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', getSettings);
router.put('/', protect, admin, updateSettings);
router.post('/clean-orphan-images', protect, admin, triggerOrphanImagesCleanup);

export default router;
