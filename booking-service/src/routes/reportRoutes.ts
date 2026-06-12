import express from 'express';
import { getReportsData } from '../controllers/reportController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, admin, getReportsData);

export default router;
