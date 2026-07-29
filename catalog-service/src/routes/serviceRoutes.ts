import express from 'express';
import {
  getServices,
  getServiceById,
  getBookingOverviewBundle,
  getCatalogCacheMetrics,
  getCatalogPrometheusMetrics,
  createService,
  updateService,
  deleteService,
} from '../controllers/serviceController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/',                     getServices);
router.get('/cache-metrics',        protect, admin, getCatalogCacheMetrics);
router.get('/metrics/prometheus',   getCatalogPrometheusMetrics);
router.get('/booking-overview/:id', getBookingOverviewBundle);
router.get('/:id',                  getServiceById);
router.post('/',            protect, admin, createService);
router.put('/:id',          protect, admin, updateService);
router.delete('/:id',       protect, admin, deleteService);

export default router;
