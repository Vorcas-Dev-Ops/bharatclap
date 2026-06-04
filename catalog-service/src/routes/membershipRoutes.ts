import express from 'express';
import { protect, admin } from '../middleware/authMiddleware';
import {
  createMembership,
  getAllMemberships,
  updateMembership,
  deleteMembership,
  getMembershipUsers,
  getMembershipStats
} from '../controllers/membershipController';

const router = express.Router();

router.get('/', getAllMemberships);

router.post('/', protect, admin, createMembership);
router.get('/stats', protect, admin, getMembershipStats);
router.put('/:id', protect, admin, updateMembership);
router.delete('/:id', protect, admin, deleteMembership);
router.get('/:id/users', protect, admin, getMembershipUsers);

export default router;
