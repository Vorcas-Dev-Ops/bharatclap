import express from 'express';
import { getLocations, getLocationById, createLocation, updateLocation, deleteLocation } from '../controllers/locationController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(getLocations)
  .post(protect, admin, createLocation);

router.route('/:id')
  .get(getLocationById)
  .put(protect, admin, updateLocation)
  .delete(protect, admin, deleteLocation);

export default router;
