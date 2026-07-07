import express from 'express';
import {
  getProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
  getMyProviderProfile,
  updateMyProviderProfile,
  getMyJobRequests,
  acceptJobRequest,
  rejectJobRequest,
  updateLiveLocation,
  updateMyAvailability,
  socketEmitInternal,
  processVerificationAction,
  checkProviderAvailability,
  getProvidersBatch,
  getProviderStats,
  getActiveSubservices
} from '../controllers/providerController';
import { dispatchToProviders, dispatchBatchToProviders } from '../controllers/dispatchController';
import { protect, admin } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

// ── Internal service-to-service endpoints (require x-internal-service-key) ──
router.post('/internal/dispatch',       internalAuth, dispatchToProviders);
router.post('/internal/dispatch-batch', internalAuth, dispatchBatchToProviders);
router.post('/socket-emit',             internalAuth, socketEmitInternal);
router.post('/batch',                   internalAuth, getProvidersBatch);
router.post('/internal/active-subservices', internalAuth, getActiveSubservices);
router.get('/stats',                    internalAuth, getProviderStats);

// ── Public endpoints ──────────────────────────────────────────────────────────
router.get('/check-availability',       checkProviderAvailability);

router.get('/me',                       protect, getMyProviderProfile);
router.put('/me',                       protect, updateMyProviderProfile);

// Job Requests & Status Rate Limiter
import rateLimit from 'express-rate-limit';

const jobActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many job actions from this IP, please try again after a minute'
});

router.get('/job-requests',            protect, getMyJobRequests);
router.post('/job-requests/:id/accept', protect, jobActionLimiter, acceptJobRequest);
router.post('/job-requests/:id/reject', protect, jobActionLimiter, rejectJobRequest);
router.patch('/live-location',        protect, updateLiveLocation);
router.put('/availability',           protect, updateMyAvailability);

router.get('/',                       protect, admin, getProviders);
router.get('/:id',                    protect, admin, getProviderById);
router.post('/',                      protect, admin, createProvider);
router.put('/:id',                    protect, admin, updateProvider);
router.post('/:id/verification-action', protect, admin, processVerificationAction);
router.delete('/:id',                 protect, admin, deleteProvider);

export default router;
