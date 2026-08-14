import express from 'express';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart, updateSlot, updateCartScheduling, getUserCartInternal } from '../controllers/cartController';
import { protect } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

// Internal route for service-to-service cart validation
router.get('/internal/user-cart/:userId', internalAuth, getUserCartInternal);

router.use(protect);


router.get('/', getCart);
router.post('/add', addToCart);
router.put('/slot', updateSlot);
router.put('/scheduling', updateCartScheduling);
router.put('/update', updateCartItem);
router.delete('/item/:id', removeFromCart);
router.delete('/', clearCart);

export default router;
