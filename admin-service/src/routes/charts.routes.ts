import { Router } from 'express';
import { ChartsController } from '../controllers/charts.controller';

const router = Router();

router.get('/revenue-chart', ChartsController.getRevenueChart);
router.get('/booking-chart', ChartsController.getBookingChart);
router.get('/order-status', ChartsController.getOrderStatusChart);
router.get('/service-distribution', ChartsController.getServiceDistributionChart);
router.get('/provider-performance', ChartsController.getProviderPerformanceChart);
router.get('/peak-time-heatmap', ChartsController.getPeakTimeHeatmapChart);
router.get('/recent-reviews', ChartsController.getRecentReviewsChart);

export default router;
