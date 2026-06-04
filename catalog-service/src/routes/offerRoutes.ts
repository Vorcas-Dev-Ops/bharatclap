import express from 'express';
import { getActiveOffers, getAllOffersAdmin, createOffer, updateOffer, deleteOffer } from '../controllers/offerController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(getActiveOffers)
  .post(protect, admin, createOffer);

router.get('/admin', protect, admin, getAllOffersAdmin);

router.route('/:id')
  .put(protect, admin, updateOffer)
  .delete(protect, admin, deleteOffer);

export default router;
