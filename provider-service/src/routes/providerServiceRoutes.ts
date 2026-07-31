import express from 'express';
import { 
  addProviderService, 
  getProviderServices, 
  updateProviderService, 
  deleteProviderService, 
  getAllProviderServices,
  updateServiceLocationStatus
} from '../controllers/providerServiceController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.put('/locations/manage', protect, updateServiceLocationStatus);

router.route('/')
  .get(protect, admin, getAllProviderServices)
  .post(protect, addProviderService);

router.get('/:providerId', getProviderServices);

router.route('/:id')
  .put(protect, updateProviderService)
  .delete(protect, deleteProviderService);

export default router;
