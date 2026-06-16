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
import { dispatchToProviders } from '../controllers/dispatchController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// ── Public endpoints ─────────────────────────────────────────────────────────
router.post('/internal/dispatch',       dispatchToProviders);
router.get('/check-availability',       checkProviderAvailability);
router.post('/socket-emit',             socketEmitInternal);
router.post('/batch',                   getProvidersBatch);
router.post('/internal/active-subservices', getActiveSubservices);
router.get('/stats',                    getProviderStats);

router.get('/me',                       protect, getMyProviderProfile);
router.put('/me',                       protect, updateMyProviderProfile);

// Job Requests & Status
router.get('/job-requests',            protect, getMyJobRequests);
router.post('/job-requests/:id/accept', protect, acceptJobRequest);
router.post('/job-requests/:id/reject', protect, rejectJobRequest);
router.patch('/live-location',        protect, updateLiveLocation);
router.put('/availability',           protect, updateMyAvailability);

router.get('/',                       protect, admin, getProviders);
router.get('/:id',                    protect, admin, getProviderById);
router.post('/',                      protect, admin, createProvider);
router.put('/:id',                    protect, admin, updateProvider);
router.post('/:id/verification-action', protect, admin, processVerificationAction);
router.delete('/:id',                 protect, admin, deleteProvider);

export default router;
