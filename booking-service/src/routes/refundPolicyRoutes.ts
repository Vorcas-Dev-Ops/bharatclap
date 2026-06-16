import express from 'express';
import { getRefundPolicy, updateRefundPolicy } from '../controllers/refundPolicyController';

const router = express.Router();

router.get('/', getRefundPolicy);
router.put('/', updateRefundPolicy);

export default router;
