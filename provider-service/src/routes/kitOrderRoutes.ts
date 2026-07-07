import express from 'express';
import { getKitOrders, updateKitOrder, createDummyOrder } from '../controllers/kitOrderController';

const router = express.Router();

router.get('/', getKitOrders);
router.post('/dummy', createDummyOrder);
router.put('/:id', updateKitOrder);

export default router;
