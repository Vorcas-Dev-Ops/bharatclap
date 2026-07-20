import express from 'express';
import { getMyProviderProfile, updateMyProviderProfile } from '../controllers/provider/profileController';
import { updateMyAvailability, checkProviderAvailability, releaseProviderInternal } from '../controllers/provider/availabilityController';
import { updateLiveLocation, updateProviderLocationHttp, getLiveProvidersAdmin, getNearestProvidersAdmin } from '../controllers/provider/locationController';
import { processVerificationAction } from '../controllers/provider/verificationController';
import { getMyJobRequests, acceptJobRequest, rejectJobRequest } from '../controllers/provider/jobRequestController';
import { getProviders, getProvidersBatch, getProvidersByUserIds, getProviderStats, getProviderById, createProvider, updateProvider, deleteProvider, socketEmitInternal, getActiveSubservices, releaseProviderAdmin, getDispatchHistory, getKitPurchases, getKitTracking, getKitPickups, updateKitPickupStatus } from '../controllers/provider/managementController';
import { dispatchToProviders, dispatchBatchToProviders } from '../controllers/dispatchController';
import { protect, admin, checkPermission, checkKitApproval } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import { getOnboardingStarterKit, getOnboardingAccessories, createOnboardingOrder, verifyOnboardingPayment, skipOnboarding } from '../controllers/provider/onboardingController';
import { createRechargeOrder, verifyRecharge, getWalletBalance, getWalletTransactions, getAdminWallets } from '../controllers/provider/walletController';
import { createInternalSettlement, updateBankDetails, getEarningsPayouts, remitCodDues, getAdminSettlements, processSettlementAction } from '../controllers/provider/settlementController';

const router = express.Router();

// ── Internal service-to-service endpoints (require x-internal-service-key) ──
router.post('/internal/dispatch',       internalAuth, dispatchToProviders);
router.post('/internal/dispatch-batch', internalAuth, dispatchBatchToProviders);
router.post('/internal/release',        internalAuth, releaseProviderInternal);
router.post('/internal/settlements/create', internalAuth, createInternalSettlement);
router.post('/socket-emit',             internalAuth, socketEmitInternal);
router.post('/batch',                   internalAuth, getProvidersBatch);
router.post('/by-user-ids',             internalAuth, getProvidersByUserIds);
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
router.post('/job-requests/:id/accept', protect, checkKitApproval, jobActionLimiter, acceptJobRequest);
router.post('/job-requests/:id/reject', protect, checkKitApproval, jobActionLimiter, rejectJobRequest);
router.post('/location/update',        protect, checkKitApproval, updateProviderLocationHttp);
router.patch('/live-location',        protect, checkKitApproval, updateLiveLocation);
router.put('/availability',           protect, checkKitApproval, updateMyAvailability);

router.get('/onboarding/starter-kit',      protect, getOnboardingStarterKit);
router.get('/onboarding/accessories',      protect, getOnboardingAccessories);
router.post('/onboarding/create-order',    protect, createOnboardingOrder);
router.post('/onboarding/verify-payment',  protect, verifyOnboardingPayment);
router.post('/onboarding/skip',            protect, skipOnboarding);

// Wallet routes
router.post('/wallet/recharge/create-order', protect, createRechargeOrder);
router.post('/wallet/recharge/verify',       protect, verifyRecharge);
router.get('/wallet/balance',                protect, getWalletBalance);
router.get('/wallet/transactions',           protect, getWalletTransactions);
router.get('/admin/wallets',                 protect, admin, getAdminWallets);

// Settlement routes
router.post('/bank-details',                 protect, updateBankDetails);
router.get('/earnings-payouts',              protect, getEarningsPayouts);
router.post('/wallet/remit-cod',             protect, remitCodDues);
router.get('/admin/settlements',             protect, admin, getAdminSettlements);
router.post('/admin/settlements/:id/action', protect, admin, processSettlementAction);

router.get('/admin/live-providers',    protect, admin, checkPermission('providers', 'view'), getLiveProvidersAdmin);
router.get('/admin/nearest-providers', protect, admin, checkPermission('providers', 'view'), getNearestProvidersAdmin);

router.get('/',                       protect, admin, checkPermission('providers', 'view'), getProviders);
router.get('/kit-purchases',          protect, admin, checkPermission('providers', 'view'), getKitPurchases);
router.get('/kit-tracking',           protect, admin, checkPermission('providers', 'view'), getKitTracking);
router.get('/kit-pickups',            protect, admin, checkPermission('providers', 'view'), getKitPickups);
router.put('/kit-pickups/:id/fulfillment', protect, admin, checkPermission('providers', 'update'), updateKitPickupStatus);
router.get('/:id',                    protect, admin, checkPermission('providers', 'view'), getProviderById);
router.post('/',                      protect, admin, checkPermission('providers', 'update'), createProvider);
router.put('/:id',                    protect, admin, checkPermission('providers', 'update'), updateProvider);
router.post('/:id/verification-action', protect, admin, checkPermission('providers', 'update'), processVerificationAction);
router.post('/:id/release',           protect, admin, checkPermission('providers', 'release'), releaseProviderAdmin);
router.get('/dispatch-history/:bookingId', protect, admin, checkPermission('providers', 'view'), getDispatchHistory);
router.delete('/:id',                 protect, admin, checkPermission('providers', 'update'), deleteProvider);

export default router;
