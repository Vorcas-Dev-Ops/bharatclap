import express from 'express';
import { getAllPayouts, requestPayout, getPayoutById, updatePayoutStatus } from '../controllers/payoutController';
import { protect, admin, checkPermission } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(protect, admin, checkPermission('payouts', 'view'), getAllPayouts)
  .post(protect, requestPayout);

router.route('/:id')
  .get(protect, admin, checkPermission('payouts', 'view'), getPayoutById);

router.route('/:id/status')
  .put(protect, admin, checkPermission('payouts', 'update'), updatePayoutStatus);

export default router;
