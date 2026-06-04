import express from 'express';
import { getReports, createReport, deleteReport } from '../controllers/adminReportController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);
router.use(admin);

router.route('/')
  .get(getReports)
  .post(createReport);

router.route('/:id')
  .delete(deleteReport);

export default router;
