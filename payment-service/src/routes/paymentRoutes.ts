import express from 'express';
import { processPayment, getPaymentByBooking, getAllPayments, getMyPayments, createRazorpayOrder, verifyRazorpayPayment, linkBookingToPayment, handleRazorpayWebhook, retryPaymentLinkAdmin, createCollectionLink } from '../controllers/paymentController';
import { runDailyReconciliation, runMonthlyClosing, getCodOverview, getFinanceExceptions } from '../controllers/financeReconciliationController';
import { protect, admin, checkPermission, internalAuth } from '../middleware/authMiddleware';
import { validate, createRazorpayOrderSchema, verifyRazorpayPaymentSchema, processPaymentSchema } from '../middleware/validate';

const router = express.Router();

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
router.post('/create-collection-link', internalAuth, createCollectionLink);

router.route('/')
  .get(protect, admin, checkPermission('payments', 'view'), getAllPayments)
  .post(protect, validate(processPaymentSchema), processPayment);

router.get('/:bookingId', protect, getPaymentByBooking);

export default router;
