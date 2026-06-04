import express from 'express';
import { getMyWallet, withdrawMoney } from '../controllers/walletController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/me', protect, getMyWallet);
router.post('/withdraw', protect, withdrawMoney);

export default router;
