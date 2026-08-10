import express from 'express';
import { getDashboardStats, getLiveKpis, getLiveQueue } from '../controllers/dashboardController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/stats', protect, admin, getDashboardStats);
router.get('/live-kpis', protect, admin, getLiveKpis);
router.get('/live-queue', protect, admin, getLiveQueue);

export default router;
