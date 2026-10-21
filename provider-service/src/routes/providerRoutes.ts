import express from 'express';
import { protect, admin, checkPermission, checkKitApproval, providerOnly } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import { getMyProviderProfile, updateMyProviderProfile, getProviderPaymentProfile, updateProviderUpiProfile, submitForReview } from '../controllers/provider/profileController';

const router = express.Router();

// Provider Payment & UPI Profile Routes
router.get('/me/payment-profile', protect, providerOnly, getProviderPaymentProfile);
router.post('/me/upi-profile', protect, providerOnly, updateProviderUpiProfile);
import { updateMyAvailability, checkProviderAvailability, releaseProviderInternal } from '../controllers/provider/availabilityController';
import { updateLiveLocation, updateProviderLocationHttp, getLiveProvidersAdmin, getNearestProvidersAdmin } from '../controllers/provider/locationController';
import { processVerificationAction } from '../controllers/provider/verificationController';
import { getMyJobRequests, acceptJobRequest, rejectJobRequest, confirmReady, requestCancellation } from '../controllers/provider/jobRequestController';
import { getProviders, getProvidersBatch, getProvidersByUserIds, getProviderStats, getProviderById, createProvider, updateProvider, deleteProvider, socketEmitInternal, getActiveSubservices, releaseProviderAdmin, getDispatchHistory, getKitPurchases, getKitTracking, getKitPickups, updateKitPickupStatus, getSubscriptionPolicies, upsertSubscriptionPolicy, updateProviderSubscriptionAdmin, getSubscriptionDashboardStatsAdmin, getProviderAuditLogsAdmin, getWalletCenterStatsAdmin, searchProvidersInternal, getKitCollectionSettings, saveKitCollectionSettings, getPendingKitCollections, getKitCollectionHistory, confirmKitCollection } from '../controllers/provider/managementController';


import { dispatchToProviders, dispatchBatchToProviders, validateMultiSchedule } from '../controllers/dispatchController';
import { getOnboardingStarterKit, getOnboardingAccessories, createOnboardingOrder, verifyOnboardingPayment, selectAccessPlan, skipOnboarding, getKitCollectionDetails } from '../controllers/provider/onboardingController';
import { createRechargeOrder, verifyRecharge, getWalletBalance, getWalletTransactions, getAdminWallets } from '../controllers/provider/walletController';
import { createInternalSettlement, updateBankDetails, getEarningsPayouts, remitCodDues, verifyCodRemittancePayment, getAdminSettlements, processSettlementAction, getProviderDashboardAnalytics, releaseSettlementPayoutAdmin, createManualAdjustmentAdmin, batchProcessAdminSettlements } from '../controllers/provider/settlementController';
import { handleRazorpayPayoutWebhook } from '../controllers/payoutWebhookController';
import { handleFundAccountValidationWebhook } from '../controllers/provider/fundAccountValidationController';
import { getLeadPackagesAdmin, createLeadPackageAdmin, updateLeadPackageAdmin, deleteLeadPackageAdmin, getActiveLeadPackages, createLeadPackagePurchaseOrder, verifyLeadPackagePayment, getProviderLeadBalanceAndHistory, getLeadPackageDashboardStatsAdmin, adminAdjustLeads } from '../controllers/provider/leadPackageController';
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
import {
  getAdminCodSummary,
  getAdminCodDetails,
  sendCodReminderAdmin,
  requestCodDepositAdmin,
  recordCashDepositAdmin,
  getProviderCodStatus,
  payCodOnline,
  getNearestHubs,
  getProviderCodHistory
} from '../controllers/provider/codController';

import { getDb } from '../config/db';

// ── Provider Refer & Earn Routes ───────────────────────────────────────────
router.get('/referral/dashboard',                  protect, providerOnly, getReferralDashboardController);
router.post('/referral/apply',                      protect, providerOnly, applyReferralCodeController);
router.post('/internal/referral/trigger-job-reward', triggerFirstJobRewardController);

// ── Admin Provider Referral Routes ──────────────────────────────────────────
router.get('/admin/referrals/campaigns',             protect, admin, getAdminCampaignsController);
router.post('/admin/referrals/campaigns',            protect, admin, createAdminCampaignController);
router.put('/admin/referrals/campaigns/:id',        protect, admin, updateAdminCampaignController);
router.post('/admin/referrals/campaigns/:id/duplicate', protect, admin, duplicateAdminCampaignController);
router.get('/admin/referrals/analytics',             protect, admin, getAdminReferralAnalyticsController);
router.get('/admin/referrals/list',                  protect, admin, getAdminReferralsListController);
router.post('/admin/referrals/:id/fraud-review',     protect, admin, processFraudReviewController);

// ── Rate Limiters ─────────────────────────────────────────────────────────
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient, isRedisHealthy } from '../services/socketService';
import { handleRazorpayProviderWebhook } from '../controllers/provider/webhookController';

const getSharedRateLimitStore = (prefix: string) => {
  if (redisClient) {
    try {
      return new RedisStore({
        // @ts-expect-error - ioredis sendCommand signature compatibility
        sendCommand: (...args: string[]) => redisClient.call(...args),
        prefix: `rl:${prefix}:`
      });
    } catch {
      return undefined;
    }
  }
  return undefined;
};

// Enforce distributed rate limiting policy:
// In production (or when ENFORCE_DISTRIBUTED_RATE_LIMIT=true), reject payment/lifecycle requests if Redis is unavailable.
// This prevents bypassing rate limits across multiple server instances (Server A, Server B, Server C).
const checkDistributedRateLimitingPolicy = (req: any, res: any, next: any) => {
  const isEnforced = process.env.NODE_ENV === 'production' || process.env.ENFORCE_DISTRIBUTED_RATE_LIMIT === 'true';
  if (!isRedisHealthy()) {
    if (isEnforced) {
      console.error(`[CRITICAL SECURITY ALERT] Redis rate limiter offline during ${req.method} ${req.originalUrl}. Fail-closed policy enforced.`);
      return res.status(503).json({
        success: false,
        code: 'DISTRIBUTED_SECURITY_DEGRADED',
        message: 'Security validation services are temporarily unavailable. Please try again in a few seconds.'
      });
    } else {
      console.warn(`[RATE-LIMIT WARNING] Redis offline during ${req.method} ${req.originalUrl}. Operating with per-instance fallback in dev mode.`);
    }
  }
  next();
};

const jobActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 60,
  keyGenerator: (req: any) => String(req.user?.id || req.user?._id || ipKeyGenerator(req.ip)),
  validate: false,
  message: 'Too many job actions, please try again after a minute'
});

// ponytail: rate limit financial endpoints — tighter window than job actions
const walletFinanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  validate: false,
  message: 'Too many financial requests, please try again after a minute'
});

const adminFinanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  validate: false,
  message: 'Too many admin financial requests, please try again after a minute'
});

// Kit Order Creation: 5 requests / min / provider + IP (Distributed across instances via Redis)
const kitCreateOrderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  store: getSharedRateLimitStore('kit-order'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => `${req.user?.id || 'anon'}_${ipKeyGenerator(req.ip)}`,
  validate: false,
  handler: (req: any, res: any) => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait and try again.'
    });
  }
});

// Kit Payment Verification: 10 requests / min / provider + IP (Distributed across instances via Redis)
const kitVerifyPaymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  store: getSharedRateLimitStore('kit-verify'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => `${req.user?.id || 'anon'}_${ipKeyGenerator(req.ip)}`,
  validate: false,
  handler: (req: any, res: any) => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait and try again.'
    });
  }
});

// Access Plan Activation: 10 requests / min / provider + IP (Distributed across instances via Redis)
const accessPlanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  store: getSharedRateLimitStore('access-plan'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => `${req.user?.id || 'anon'}_${ipKeyGenerator(req.ip)}`,
  validate: false,
  handler: (req: any, res: any) => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait and try again.'
    });
  }
});

// Admin Kit Confirmation: 30 requests / min / admin + IP (Distributed across instances via Redis)
const adminKitConfirmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  store: getSharedRateLimitStore('admin-confirm'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => `${req.user?.id || 'anon'}_${ipKeyGenerator(req.ip)}`,
  validate: false,
  handler: (req: any, res: any) => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait and try again.'
    });
  }
});

// Settlement & Analytics routes
router.get('/dashboard-analytics',           protect, providerOnly, getProviderDashboardAnalytics);
router.post('/bank-details',                 protect, providerOnly, updateBankDetails);
router.get('/earnings-payouts',              protect, providerOnly, getEarningsPayouts);
router.post('/wallet/remit-cod',             protect, providerOnly, remitCodDues);
router.get('/admin/settlements',             protect, admin, checkPermission('payouts', 'view'),   getAdminSettlements);
router.post('/admin/settlements/:id/action', protect, admin, checkPermission('payouts', 'update'), processSettlementAction);
router.post('/admin/adjustments',             protect, admin, checkPermission('wallet', 'credit_wallet'), adminFinanceLimiter, createManualAdjustmentAdmin);

// ── Subscription & Wallet Center Admin Routes ───────────────────────────────
router.get('/admin/subscription-policies',             protect, admin, getSubscriptionPolicies);
router.post('/admin/subscription-policies',            protect, admin, checkPermission('subscription', 'update'), adminFinanceLimiter, upsertSubscriptionPolicy);
router.post('/admin/:id/subscription',                 protect, admin, checkPermission('subscription', 'update'), adminFinanceLimiter, updateProviderSubscriptionAdmin);
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
router.post('/admin/lead-packages/adjust',              protect, admin, adminAdjustLeads);

// ── Dispatch Settings & Load Balancing Admin Routes ────────────────────────
router.get('/admin/dispatch-settings',                 protect, admin, getDispatchSettingsAdmin);
router.post('/admin/dispatch-settings',                protect, admin, updateDispatchSettingsAdmin);

// ── Category Dispatch Rules Admin Routes ───────────────────────────────────
router.get('/admin/category-rules',                    protect, admin, getCategoryRulesAdmin);
router.post('/admin/category-rules',                   protect, admin, upsertCategoryRuleAdmin);
router.get('/admin/performance-analytics',             protect, admin, getAdminProviderPerformanceAnalytics);

// ── Enterprise Wallet Security & Audit Admin Routes ───────────────────────
router.post('/admin/wallet-adjustment',                protect, admin, checkPermission('wallet', 'credit_wallet'), adminFinanceLimiter, createWalletAdjustmentAdmin);
router.post('/admin/freeze-wallet',                   protect, admin, checkPermission('wallet', 'freeze_wallet'), adminFinanceLimiter, freezeWalletAdmin);
router.post('/admin/unfreeze-wallet',                 protect, admin, checkPermission('wallet', 'unfreeze_wallet'), adminFinanceLimiter, unfreezeWalletAdmin);
router.get('/admin/wallet-audit-logs',                 protect, admin, checkPermission('wallet', 'view'), getWalletAuditLogsAdmin);
router.post('/admin/approve-wallet-adjustment/:auditLogId', protect, admin, checkPermission('wallet', 'approve_high_value'), adminFinanceLimiter, approveHighValueAdjustmentAdmin);

// ── Provider Personal Analytics & Shop Routes ──────────────────────────────
router.get('/personal-analytics',                      protect, providerOnly, getProviderPersonalAnalytics);
router.get('/lead-packages',                           protect, providerOnly, getActiveLeadPackages);
router.post('/lead-packages/purchase',                 protect, providerOnly, walletFinanceLimiter, createLeadPackagePurchaseOrder);
router.post('/lead-packages/verify',                   protect, providerOnly, walletFinanceLimiter, verifyLeadPackagePayment);
router.get('/lead-balance',                            protect, providerOnly, getProviderLeadBalanceAndHistory);

import { reconcileMissingSettlements } from '../utils/settlementReconciliation';

router.post('/internal/reconcile-settlements', internalAuth, async (req, res) => {
  try {
    const result = await reconcileMissingSettlements();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.post('/admin/reconcile-settlements', protect, admin, async (req, res) => {
  try {
    const result = await reconcileMissingSettlements();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
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
    const psList = await getDb().query(`SELECT * FROM provider.provider_services LIMIT 100`);
    res.json(psList.rows);
  });

  router.get('/debug-jobrequests', protect, admin, async (req, res) => {
    const docs = await getDb().query(`SELECT * FROM provider.job_requests ORDER BY created_at DESC LIMIT 10`);
    res.json(docs.rows);
  });
}
router.get('/check-availability',       checkProviderAvailability);
router.post('/internal/validate-multi-schedule', internalAuth, validateMultiSchedule);
router.post('/validate-multi-schedule',          validateMultiSchedule);

router.get('/me',                       protect, providerOnly, getMyProviderProfile);
router.put('/me',                       protect, providerOnly, updateMyProviderProfile);
router.post('/me/submit',               protect, providerOnly, submitForReview);


router.get('/job-requests',                             protect, providerOnly, getMyJobRequests);
router.post('/job-requests/:id/accept',                protect, providerOnly, checkKitApproval, jobActionLimiter, acceptJobRequest);
router.post('/job-requests/:id/reject',                protect, providerOnly, checkKitApproval, jobActionLimiter, rejectJobRequest);
router.post('/job-requests/:bookingId/confirm-ready',         protect, providerOnly, confirmReady);
router.post('/job-requests/:bookingId/request-cancellation', protect, providerOnly, requestCancellation);
router.post('/location/update',        protect, providerOnly, updateProviderLocationHttp);
router.patch('/live-location',        protect, providerOnly, updateLiveLocation);
router.put('/availability',           protect, providerOnly, updateMyAvailability);

router.get('/onboarding/starter-kit',      protect, providerOnly, getOnboardingStarterKit);
router.get('/onboarding/accessories',      protect, providerOnly, getOnboardingAccessories);
router.post('/onboarding/create-order',    protect, providerOnly, checkDistributedRateLimitingPolicy, kitCreateOrderLimiter, createOnboardingOrder);
router.post('/onboarding/verify-payment',  protect, providerOnly, checkDistributedRateLimitingPolicy, kitVerifyPaymentLimiter, verifyOnboardingPayment);
router.get('/onboarding/kit-collection',   protect, providerOnly, getKitCollectionDetails);
router.get('/kit-collection-details',      protect, providerOnly, getKitCollectionDetails);
router.post('/access-plan',                 protect, providerOnly, checkDistributedRateLimitingPolicy, accessPlanLimiter, selectAccessPlan);
router.post('/onboarding/access-plan',      protect, providerOnly, checkDistributedRateLimitingPolicy, accessPlanLimiter, selectAccessPlan);
// Wallet routes
router.post('/wallet/recharge/create-order', protect, providerOnly, walletFinanceLimiter, createRechargeOrder);
router.post('/wallet/recharge/verify',       protect, providerOnly, walletFinanceLimiter, verifyRecharge);
router.get('/wallet/balance',                protect, providerOnly, getWalletBalance);
router.get('/wallet/transactions',           protect, providerOnly, getWalletTransactions);
router.get('/admin/wallets',                 protect, admin, getAdminWallets);

// Settlement & Analytics routes
router.get('/dashboard-analytics',           protect, providerOnly, getProviderDashboardAnalytics);
router.post('/bank-details',                 protect, providerOnly, updateBankDetails);
router.get('/earnings-payouts',              protect, providerOnly, getEarningsPayouts);
router.post('/wallet/remit-cod',             protect, providerOnly, remitCodDues);
router.post('/wallet/remit-cod/verify',      protect, providerOnly, verifyCodRemittancePayment);
router.get('/admin/settlements',             protect, admin, checkPermission('payouts', 'view'),   getAdminSettlements);
router.post('/admin/settlements/:id/action', protect, admin, checkPermission('payouts', 'update'), processSettlementAction);
router.post('/admin/settlements/:id/release-payout', protect, admin, checkPermission('payouts', 'update'), releaseSettlementPayoutAdmin);
router.post('/admin/settlements/batch-payout', protect, admin, checkPermission('payouts', 'update'), batchProcessAdminSettlements);
router.post('/webhooks/razorpay-payouts',                    handleRazorpayPayoutWebhook);
router.post('/webhooks/razorpay-fund-account-validation',    handleFundAccountValidationWebhook);
router.post('/webhooks/razorpay',                            handleRazorpayProviderWebhook);
router.post('/onboarding/webhook',                           handleRazorpayProviderWebhook);

// ── Enterprise COD Collection Workflow Routes ─────────────────────────────
router.get('/admin/cod-summary',                     protect, admin, getAdminCodSummary);
router.get('/admin/cod-details/:id',                 protect, admin, getAdminCodDetails);
router.post('/admin/send-cod-reminder/:id',          protect, admin, sendCodReminderAdmin);
router.post('/admin/request-cod-deposit/:id',        protect, admin, requestCodDepositAdmin);
router.post('/admin/record-cash-deposit/:id',        protect, admin, recordCashDepositAdmin);

router.get('/cod-status',                            protect, providerOnly, getProviderCodStatus);
router.post('/cod/pay-online',                       protect, providerOnly, payCodOnline);
router.get('/hubs',                                  protect, providerOnly, getNearestHubs);
router.get('/cod-history',                           protect, providerOnly, getProviderCodHistory);

router.get('/admin/live-providers',    protect, admin, checkPermission('providers', 'view'), getLiveProvidersAdmin);
router.get('/admin/nearest-providers', protect, admin, checkPermission('providers', 'view'), getNearestProvidersAdmin);

router.get('/',                       protect, admin, checkPermission('providers', 'view'), getProviders);
router.get('/kit-purchases',          protect, admin, checkPermission('providers', 'view'), getKitPurchases);
router.get('/kit-tracking',           protect, admin, checkPermission('providers', 'view'), getKitTracking);
router.get('/kit-pickups',            protect, admin, checkPermission('providers', 'view'), getKitPickups);
router.put('/kit-pickups/:id/fulfillment', protect, admin, checkPermission('providers', 'update'), updateKitPickupStatus);
router.get('/admin/kit-collection/settings', protect, admin, checkPermission('providers', 'view'), getKitCollectionSettings);
router.put('/admin/kit-collection/settings', protect, admin, checkPermission('providers', 'update'), saveKitCollectionSettings);
router.get('/admin/kit-collection/pending',  protect, admin, checkPermission('providers', 'view'), getPendingKitCollections);
router.get('/admin/kit-collection/history',  protect, admin, checkPermission('providers', 'view'), getKitCollectionHistory);
router.post('/admin/kit-collection/confirm', protect, admin, checkPermission('providers', 'update'), checkDistributedRateLimitingPolicy, adminKitConfirmLimiter, confirmKitCollection);
router.get('/:id',                    protect, admin, checkPermission('providers', 'view'), getProviderById);
router.post('/',                      protect, admin, checkPermission('providers', 'update'), createProvider);
router.put('/:id',                    protect, admin, checkPermission('providers', 'update'), updateProvider);
router.post('/:id/verification-action', protect, admin, checkPermission('providers', 'update'), processVerificationAction);
router.post('/:id/release',           protect, admin, checkPermission('providers', 'release'), releaseProviderAdmin);
router.get('/dispatch-history/:bookingId', protect, admin, checkPermission('providers', 'view'), getDispatchHistory);
router.delete('/:id',                 protect, admin, checkPermission('providers', 'update'), deleteProvider);

export default router;
