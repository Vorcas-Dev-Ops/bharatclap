import express from 'express';
import { getLocations, getLocationById, createLocation, updateLocation, deleteLocation, getLocationsBatch } from '../controllers/locationController';
import { protect, admin } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

router.post('/batch', internalAuth, getLocationsBatch);

router.route('/')
  .get(getLocations)
  .post(protect, admin, createLocation);

router.route('/:id')
  .get(getLocationById)
  .put(protect, admin, updateLocation)
  .delete(protect, admin, deleteLocation);

export default router;
