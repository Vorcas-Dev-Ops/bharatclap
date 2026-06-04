import express from 'express';
import { addProviderService, getProviderServices, updateProviderService, deleteProviderService, getAllProviderServices } from '../controllers/providerServiceController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(protect, admin, getAllProviderServices)
  .post(protect, addProviderService);

router.get('/:providerId', getProviderServices);

router.route('/:id')
  .put(protect, updateProviderService)
  .delete(protect, deleteProviderService);

export default router;
