import express from 'express';
import { getComplaints, getComplaintsByUserId, submitComplaint, updateComplaintStatus } from '../controllers/complaintController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(protect, admin, getComplaints)
  .post(protect, submitComplaint);

router.get('/user/:userId', protect, admin, getComplaintsByUserId);

router.put('/:id', protect, admin, updateComplaintStatus);

export default router;
