import express from 'express';
import { getAllRefunds, createRefund } from '../controllers/refundController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(protect, admin, getAllRefunds)
  .post(protect, admin, createRefund);

export default router;