import express from 'express';
import { processPayment, getPaymentByBooking, getAllPayments, getMyPayments, createRazorpayOrder, verifyRazorpayPayment, linkBookingToPayment, getPaymentForVerification, handleRazorpayWebhook, retryPaymentLinkAdmin, createCollectionLink, getAuthoritativeRevenueMetrics } from '../controllers/paymentController';
import { runDailyReconciliation, runMonthlyClosing, getCodOverview, getFinanceExceptions } from '../controllers/financeReconciliationController';
import { protect, admin, checkPermission, internalAuth } from '../middleware/authMiddleware';
import { validate, createRazorpayOrderSchema, verifyRazorpayPaymentSchema, processPaymentSchema } from '../middleware/validate';

import {
  generateBookingQr,
  customerConfirmUpi,
  providerConfirmUpi,
  verifyCollection,
  initiateCashFallback,
  customerConfirmCash,
  providerConfirmCash,
  getProviderPendingRemittances,
  submitCashRemittance,
  getProviderCollectionHistory,
  raisePaymentDispute,
} from '../controllers/providerCollectionController';

import {
  getAdminProviderCollections,
  getAdminCollectionMetrics,
  reconcileCashRemittance,
  resolvePaymentDispute,
} from '../controllers/adminCollectionController';
import {
  createRazorpayBookingQr,
  getRazorpayQrStatus,
  handleRazorpayQrWebhook,
  getAdminQrReconciliation,
} from '../controllers/razorpayQrController';

const router = express.Router();

// Authoritative Revenue Metrics Route
router.get('/admin/revenue-metrics', protect, admin, getAuthoritativeRevenueMetrics);

// Dynamic Amount-Specific Razorpay UPI QR Routes
router.post('/razorpay-qr/create', protect, createRazorpayBookingQr);
router.get('/razorpay-qr/status/:bookingId', protect, getRazorpayQrStatus);
router.post('/razorpay-qr/webhook', handleRazorpayQrWebhook);
router.get('/admin/payments/razorpay-qr/reconciliation', protect, admin, getAdminQrReconciliation);

// Provider Collection & UPI QR Routes
router.post('/provider-collection/qr', protect, generateBookingQr);
router.post('/provider-collection/customer-confirm', protect, customerConfirmUpi);
router.post('/provider-collection/provider-confirm', protect, providerConfirmUpi);
router.post('/provider-collection/verify', protect, admin, verifyCollection);

// Emergency Cash Fallback Routes
router.post('/provider-collection/cash', protect, initiateCashFallback);
router.post('/provider-collection/cash/customer-confirm', protect, customerConfirmCash);
router.post('/provider-collection/cash/provider-confirm', protect, providerConfirmCash);
router.get('/provider-collection/cash/pending-remittance', protect, getProviderPendingRemittances);
router.post('/provider-collection/cash/remit', protect, submitCashRemittance);
router.get('/provider-collection/history', protect, getProviderCollectionHistory);
router.post('/provider-collection/dispute', protect, raisePaymentDispute);

// Admin Collection & Finance Dashboard Routes
router.get('/admin/provider-collections', protect, admin, getAdminProviderCollections);
router.get('/admin/dashboard-metrics', protect, admin, getAdminCollectionMetrics);
router.post('/admin/cash-remittance/reconcile', protect, admin, reconcileCashRemittance);
router.post('/admin/disputes/:id/resolve', protect, admin, resolvePaymentDispute);

router.get('/my', protect, getMyPayments);

// Razorpay routes
router.post('/create-order', protect, validate(createRazorpayOrderSchema), createRazorpayOrder);
router.post('/verify', protect, validate(verifyRazorpayPaymentSchema), verifyRazorpayPayment);
router.post('/webhook', handleRazorpayWebhook);

// Reconciliation & Finance Dashboard routes
router.get('/reconciliation/daily', protect, admin, runDailyReconciliation);
router.post('/reconciliation/monthly-closing', protect, admin, runMonthlyClosing);
router.get('/cod/overview', protect, admin, getCodOverview);
router.get('/exceptions', protect, admin, getFinanceExceptions);

// Admin routes
router.post('/:id/retry-link', protect, admin, retryPaymentLinkAdmin);

// Internal routes
router.post('/internal/link', internalAuth, linkBookingToPayment);
router.get('/internal/verify/:id', internalAuth, getPaymentForVerification);
router.post('/create-collection-link', internalAuth, createCollectionLink);

router.route('/')
  .get(protect, admin, checkPermission('payments', 'view'), getAllPayments)
  .post(protect, validate(processPaymentSchema), processPayment);

router.get('/:bookingId', protect, getPaymentByBooking);

export default router;
