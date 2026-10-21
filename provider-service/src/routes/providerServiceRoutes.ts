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
import { protect, admin, providerOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.put('/locations/manage', protect, providerOnly, updateServiceLocationStatus);
router.post('/locations/request-change', protect, providerOnly, requestLocationChange);
router.get('/locations/my-change-request', protect, providerOnly, getMyLocationChangeRequest);
router.get('/admin/change-requests', protect, admin, getAdminLocationChangeRequests);
router.put('/admin/change-requests/:id/review', protect, admin, reviewLocationChangeRequest);

router.route('/')
  .get(protect, admin, getAllProviderServices)
  .post(protect, providerOnly, addProviderService);

router.get('/:providerId', getProviderServices);

router.route('/:id')
  .put(protect, providerOnly, updateProviderService)
  .delete(protect, providerOnly, deleteProviderService);

export default router;
