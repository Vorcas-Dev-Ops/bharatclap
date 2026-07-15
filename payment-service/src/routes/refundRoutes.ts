import express from 'express';
import { getAllRefunds, createRefund, updateRefundStatus } from '../controllers/refundController';
import { protect, admin, checkPermission } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(protect, admin, checkPermission('refunds', 'view'), getAllRefunds)
  .post(protect, admin, createRefund);

router.route('/:id/status')
  .put(protect, admin, checkPermission('refunds', 'approve'), updateRefundStatus);

export default router;