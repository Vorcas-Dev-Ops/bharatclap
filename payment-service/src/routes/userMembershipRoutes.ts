import express from 'express';
import { getActiveUserMembership, getUserMembershipsByPlan, getUserMembershipsStats } from '../controllers/userMembershipController';

const router = express.Router();

router.get('/stats',                  getUserMembershipsStats);
router.get('/',                       getUserMembershipsByPlan);
router.get('/user/:userId/active',    getActiveUserMembership);

export default router;
