import { Router } from 'express';
import {
  getStats,
  getPending,
  getPolicies,
  updatePolicy,
  processAction,
  getAuditLogs,
} from '../controllers/refundAdminController';

import { handleRazorpayRefundWebhook } from '../controllers/webhookController';
import { evaluateRefund } from '../controllers/refundEvaluationController';
import { protect, admin, internalAuth } from '../middleware/authMiddleware';

const router = Router();

// Webhook endpoint (Signature verified)
router.post('/webhook', handleRazorpayRefundWebhook);

// Internal service RPC
router.post('/internal/evaluate', internalAuth, evaluateRefund);

// Admin-only management endpoints
router.get('/stats', protect, admin, getStats);
router.get('/pending', protect, admin, getPending);
router.get('/policies', protect, admin, getPolicies);
router.put('/policies', protect, admin, updatePolicy);
router.post('/:id/action', protect, admin, processAction);
router.get('/audit', protect, admin, getAuditLogs);

export default router;
