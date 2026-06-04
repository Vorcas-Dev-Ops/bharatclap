import express from 'express';
import { getAllPayouts, requestPayout } from '../controllers/payoutController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(protect, admin, getAllPayouts)
  .post(protect, requestPayout);

export default router;
