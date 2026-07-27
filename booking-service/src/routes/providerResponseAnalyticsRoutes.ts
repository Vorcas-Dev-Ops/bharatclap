import { Router } from 'express';
import { protect, admin } from '../middleware/authMiddleware';
import {
  getAnalyticsStats,
  getAnalyticsList,
  getBookingResponseDetails,
  getProviderResponseMetrics,
  warnProvider,
  suspendProvider,
  exportAnalyticsReport
} from '../controllers/admin/providerResponseAnalyticsController';

const router = Router();

router.use(protect, admin);

router.get('/stats', getAnalyticsStats);
router.get('/', getAnalyticsList);
router.get('/providers/:providerId', getProviderResponseMetrics);
router.get('/:bookingId', getBookingResponseDetails);
router.post('/export', exportAnalyticsReport);
router.post('/provider/:id/warn', warnProvider);
router.post('/provider/:id/suspend', suspendProvider);

export default router;
