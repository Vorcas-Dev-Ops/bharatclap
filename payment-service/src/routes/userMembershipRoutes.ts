import express from 'express';
import { getActiveUserMembership, getUserMembershipsByPlan, getUserMembershipsStats, purchaseMembership, renewMembership, checkMembershipExpirations } from '../controllers/userMembershipController';

const router = express.Router();

router.get('/stats',                  getUserMembershipsStats);
router.get('/',                       getUserMembershipsByPlan);
router.get('/user/:userId/active',    getActiveUserMembership);

router.post('/purchase',              purchaseMembership);
router.post('/renew',                 renewMembership);
router.post('/check-expirations',     checkMembershipExpirations);

export default router;
