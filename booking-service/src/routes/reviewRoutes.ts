import express from 'express';
import { getProviderReviews, getMyReviews, createReview, deleteReview } from '../controllers/reviewController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/my', protect, getMyReviews);
router.get('/provider/:providerId', getProviderReviews);
router.post('/', protect, createReview);
router.delete('/:id', protect, deleteReview);

export default router;
