import express from 'express';
import { getMyProviderProfile, updateMyProviderProfile } from '../controllers/provider/profileController';
import { updateMyAvailability, checkProviderAvailability, releaseProviderInternal } from '../controllers/provider/availabilityController';
import { updateLiveLocation, updateProviderLocationHttp, getLiveProvidersAdmin, getNearestProvidersAdmin } from '../controllers/provider/locationController';
import { processVerificationAction } from '../controllers/provider/verificationController';
import { getMyJobRequests, acceptJobRequest, rejectJobRequest } from '../controllers/provider/jobRequestController';
import { getProviders, getProvidersBatch, getProvidersByUserIds, getProviderStats, getProviderById, createProvider, updateProvider, deleteProvider, socketEmitInternal, getActiveSubservices, releaseProviderAdmin, getDispatchHistory, getKitPurchases, getKitTracking, getKitPickups, updateKitPickupStatus, getSubscriptionPolicies, upsertSubscriptionPolicy, updateProviderSubscriptionAdmin, getSubscriptionDashboardStatsAdmin, getProviderAuditLogsAdmin, getWalletCenterStatsAdmin, searchProvidersInternal } from '../controllers/provider/managementController';


import { dispatchToProviders, dispatchBatchToProviders } from '../controllers/dispatchController';
import { protect, admin, checkPermission, checkKitApproval } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import { getOnboardingStarterKit, getOnboardingAccessories, createOnboardingOrder, verifyOnboardingPayment, skipOnboarding } from '../controllers/provider/onboardingController';
import { createRechargeOrder, verifyRecharge, getWalletBalance, getWalletTransactions, getAdminWallets } from '../controllers/provider/walletController';
import { createInternalSettlement, updateBankDetails, getEarningsPayouts, remitCodDues, getAdminSettlements, processSettlementAction, getProviderDashboardAnalytics, releaseSettlementPayoutAdmin, createManualAdjustmentAdmin } from '../controllers/provider/settlementController';
import { getLeadPackagesAdmin, createLeadPackageAdmin, updateLeadPackageAdmin, deleteLeadPackageAdmin, getActiveLeadPackages, createLeadPackagePurchaseOrder, verifyLeadPackagePayment, getProviderLeadBalanceAndHistory, getLeadPackageDashboardStatsAdmin } from '../controllers/provider/leadPackageController';
import { getDispatchSettingsAdmin, updateDispatchSettingsAdmin } from '../controllers/provider/dispatchSettingsController';
import { getCategoryRulesAdmin, upsertCategoryRuleAdmin } from '../controllers/provider/categoryRulesController';
import { getProviderPersonalAnalytics, getAdminProviderPerformanceAnalytics } from '../controllers/provider/providerAnalyticsController';
import { createWalletAdjustmentAdmin, freezeWalletAdmin, unfreezeWalletAdmin, getWalletAuditLogsAdmin, approveHighValueAdjustmentAdmin } from '../controllers/provider/walletAuditController';
import {
  getReferralDashboardController,
  applyReferralCodeController,
  triggerFirstJobRewardController,
  getAdminCampaignsController,
  createAdminCampaignController,
  updateAdminCampaignController,
  duplicateAdminCampaignController,
  getAdminReferralAnalyticsController,
  getAdminReferralsListController,
  processFraudReviewController
} from '../controllers/provider/referralController';

import { ProviderService } from '../models/ProviderService';
import { JobRequest } from '../models/JobRequest';

const router = express.Router();

// ── Provider Refer & Earn Routes ───────────────────────────────────────────
router.get('/referral/dashboard',                  protect, getReferralDashboardController);
router.post('/referral/apply',                      protect, applyReferralCodeController);
router.post('/internal/referral/trigger-job-reward', triggerFirstJobRewardController);

// ── Admin Provider Referral Routes ──────────────────────────────────────────
router.get('/admin/referrals/campaigns',             protect, admin, getAdminCampaignsController);
router.post('/admin/referrals/campaigns',            protect, admin, createAdminCampaignController);
router.put('/admin/referrals/campaigns/:id',        protect, admin, updateAdminCampaignController);
router.post('/admin/referrals/campaigns/:id/duplicate', protect, admin, duplicateAdminCampaignController);
router.get('/admin/referrals/analytics',             protect, admin, getAdminReferralAnalyticsController);
router.get('/admin/referrals/list',                  protect, admin, getAdminReferralsListController);
router.post('/admin/referrals/:id/fraud-review',     protect, admin, processFraudReviewController);

// Settlement & Analytics routes
router.get('/dashboard-analytics',           protect, getProviderDashboardAnalytics);
router.post('/bank-details',                 protect, updateBankDetails);
router.get('/earnings-payouts',              protect, getEarningsPayouts);
router.post('/wallet/remit-cod',             protect, remitCodDues);
router.get('/admin/settlements',             protect, admin, getAdminSettlements);
router.post('/admin/settlements/:id/action', protect, admin, processSettlementAction);
router.post('/admin/adjustments',             protect, admin, createManualAdjustmentAdmin);

// ── Subscription & Wallet Center Admin Routes ───────────────────────────────
router.get('/admin/subscription-policies',             protect, admin, getSubscriptionPolicies);
router.post('/admin/subscription-policies',            protect, admin, upsertSubscriptionPolicy);
router.post('/admin/:id/subscription',                 protect, admin, updateProviderSubscriptionAdmin);
router.get('/admin/subscription-stats',                protect, admin, getSubscriptionDashboardStatsAdmin);
router.get('/admin/subscription-audit-logs',           protect, admin, getProviderAuditLogsAdmin);
router.get('/admin/:providerId/subscription-audit-logs', protect, admin, getProviderAuditLogsAdmin);
router.get('/admin/wallet-center-stats',               protect, admin, getWalletCenterStatsAdmin);

// ── Lead Package Management & Purchase Routes ──────────────────────────────
router.get('/admin/lead-packages',                     protect, admin, getLeadPackagesAdmin);
router.post('/admin/lead-packages',                    protect, admin, createLeadPackageAdmin);
router.put('/admin/lead-packages/:id',                 protect, admin, updateLeadPackageAdmin);
router.delete('/admin/lead-packages/:id',              protect, admin, deleteLeadPackageAdmin);
router.get('/admin/lead-packages/stats',               protect, admin, getLeadPackageDashboardStatsAdmin);

// ── Dispatch Settings & Load Balancing Admin Routes ────────────────────────
router.get('/admin/dispatch-settings',                 protect, admin, getDispatchSettingsAdmin);
router.post('/admin/dispatch-settings',                protect, admin, updateDispatchSettingsAdmin);

// ── Category Dispatch Rules Admin Routes ───────────────────────────────────
router.get('/admin/category-rules',                    protect, admin, getCategoryRulesAdmin);
router.post('/admin/category-rules',                   protect, admin, upsertCategoryRuleAdmin);
router.get('/admin/performance-analytics',             protect, admin, getAdminProviderPerformanceAnalytics);

// ── Enterprise Wallet Security & Audit Admin Routes ───────────────────────
router.post('/admin/wallet-adjustment',                protect, admin, checkPermission('wallet', 'credit_wallet'), createWalletAdjustmentAdmin);
router.post('/admin/freeze-wallet',                   protect, admin, checkPermission('wallet', 'freeze_wallet'), freezeWalletAdmin);
router.post('/admin/unfreeze-wallet',                 protect, admin, checkPermission('wallet', 'unfreeze_wallet'), unfreezeWalletAdmin);
router.get('/admin/wallet-audit-logs',                 protect, admin, checkPermission('wallet', 'view'), getWalletAuditLogsAdmin);
router.post('/admin/approve-wallet-adjustment/:auditLogId', protect, admin, checkPermission('wallet', 'approve_high_value'), approveHighValueAdjustmentAdmin);

// ── Provider Personal Analytics & Shop Routes ──────────────────────────────
router.get('/personal-analytics',                      protect, getProviderPersonalAnalytics);
router.get('/lead-packages',                           protect, getActiveLeadPackages);
router.post('/lead-packages/purchase',                 protect, createLeadPackagePurchaseOrder);
router.post('/lead-packages/verify',                   protect, verifyLeadPackagePayment);
router.get('/lead-balance',                            protect, getProviderLeadBalanceAndHistory);

// ── Internal service-to-service endpoints (require x-internal-service-key) ──
router.post('/internal/dispatch',       internalAuth, dispatchToProviders);
router.post('/internal/dispatch-batch', internalAuth, dispatchBatchToProviders);
router.post('/internal/release',        internalAuth, releaseProviderInternal);
router.post('/internal/settlements/create', internalAuth, createInternalSettlement);
router.post('/socket-emit',             internalAuth, socketEmitInternal);
router.post('/batch',                   internalAuth, getProvidersBatch);
router.post('/by-user-ids',             internalAuth, getProvidersByUserIds);
router.post('/internal/search',         internalAuth, searchProvidersInternal);
router.post('/internal/active-subservices', internalAuth, getActiveSubservices);
router.get('/stats',                    internalAuth, getProviderStats);
// ── Public endpoints ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  router.get('/dump-ps', protect, admin, async (req, res) => {
    const psList = await ProviderService.find({}).lean();
    res.json(psList);
  });

  router.get('/debug-jobrequests', protect, admin, async (req, res) => {
    const docs = await JobRequest.find({}).sort({ createdAt: -1 }).limit(10).lean();
    res.json(docs);
  });
}
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
router.post('/location/update',        protect, updateProviderLocationHttp);
router.patch('/live-location',        protect, updateLiveLocation);
router.put('/availability',           protect, updateMyAvailability);

router.get('/onboarding/starter-kit',      protect, getOnboardingStarterKit);
router.get('/onboarding/accessories',      protect, getOnboardingAccessories);
router.post('/onboarding/create-order',    protect, createOnboardingOrder);
router.post('/onboarding/verify-payment',  protect, verifyOnboardingPayment);
// Wallet routes
router.post('/wallet/recharge/create-order', protect, createRechargeOrder);
router.post('/wallet/recharge/verify',       protect, verifyRecharge);
router.get('/wallet/balance',                protect, getWalletBalance);
router.get('/wallet/transactions',           protect, getWalletTransactions);
router.get('/admin/wallets',                 protect, admin, getAdminWallets);

// Settlement & Analytics routes
router.get('/dashboard-analytics',           protect, getProviderDashboardAnalytics);
router.post('/bank-details',                 protect, updateBankDetails);
router.get('/earnings-payouts',              protect, getEarningsPayouts);
router.post('/wallet/remit-cod',             protect, remitCodDues);
router.get('/admin/settlements',             protect, admin, getAdminSettlements);
router.post('/admin/settlements/:id/action', protect, admin, processSettlementAction);
router.post('/admin/settlements/:id/release-payout', protect, admin, releaseSettlementPayoutAdmin);

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
