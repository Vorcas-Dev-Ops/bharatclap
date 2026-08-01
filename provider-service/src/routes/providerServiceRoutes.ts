import express from 'express';
import { 
  addProviderService, 
  getProviderServices, 
  updateProviderService, 
  deleteProviderService, 
  getAllProviderServices,
  updateServiceLocationStatus,
  requestLocationChange,
  getMyLocationChangeRequest,
  getAdminLocationChangeRequests,
  reviewLocationChangeRequest
} from '../controllers/providerServiceController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.put('/locations/manage', protect, updateServiceLocationStatus);
router.post('/locations/request-change', protect, requestLocationChange);
router.get('/locations/my-change-request', protect, getMyLocationChangeRequest);
router.get('/admin/change-requests', protect, admin, getAdminLocationChangeRequests);
router.put('/admin/change-requests/:id/review', protect, admin, reviewLocationChangeRequest);

router.route('/')
  .get(protect, admin, getAllProviderServices)
  .post(protect, addProviderService);

router.get('/:providerId', getProviderServices);

router.route('/:id')
  .put(protect, updateProviderService)
  .delete(protect, deleteProviderService);

export default router;
