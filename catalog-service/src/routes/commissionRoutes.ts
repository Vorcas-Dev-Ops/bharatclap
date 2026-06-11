import express from 'express';
import { getCommissions, createCommission, bulkUpdateCommissions, updateCommission, deleteCommission } from '../controllers/commissionController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/',               protect, admin, getCommissions);
router.post('/',              protect, admin, createCommission);
router.put('/bulk-update',    protect, admin, bulkUpdateCommissions);
router.put('/:id',            protect, admin, updateCommission);
router.delete('/:id',         protect, admin, deleteCommission);

export default router;
