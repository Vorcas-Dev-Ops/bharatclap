import express from 'express';
import { getMyProviderProfile, updateMyProviderProfile } from '../controllers/provider/profileController';
import { updateMyAvailability, checkProviderAvailability } from '../controllers/provider/availabilityController';
import { updateLiveLocation } from '../controllers/provider/locationController';
import { processVerificationAction } from '../controllers/provider/verificationController';
import { getMyJobRequests, acceptJobRequest, rejectJobRequest } from '../controllers/provider/jobRequestController';
import { getProviders, getProvidersBatch, getProviderStats, getProviderById, createProvider, updateProvider, deleteProvider, socketEmitInternal, getActiveSubservices } from '../controllers/provider/managementController';
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
import { ProviderService } from '../models/ProviderService';
router.get('/dump-ps', async (req, res) => {
  const psList = await ProviderService.find({}).lean();
  res.json(psList);
});

// TEMP: debug route for JobRequests
import { JobRequest } from '../models/JobRequest';
router.get('/debug-jobrequests', async (req, res) => {
  const docs = await JobRequest.find({}).sort({ createdAt: -1 }).limit(10).lean();
  res.json(docs);
});
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
