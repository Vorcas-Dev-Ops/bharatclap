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

const router = Router();

router.post('/webhook', handleRazorpayRefundWebhook);
router.get('/stats', getStats);
router.get('/pending', getPending);
router.get('/policies', getPolicies);
router.put('/policies', updatePolicy);
router.post('/:id/action', processAction);
router.get('/audit', getAuditLogs);

export default router;
