import express from 'express';
import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getAddressesBatch,
} from '../controllers/addressController';
import { protect } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import { Address } from '../models/Address';

const router = express.Router();

// Internal batch lookup (no user auth needed)
router.post('/batch', internalAuth, getAddressesBatch);

router.route('/')
  .get(protect, getAddresses)
  .post(protect, addAddress);

router.patch('/:id/set-default', protect, setDefaultAddress);

router.route('/:id')
  .put(protect, updateAddress)
  .delete(protect, deleteAddress);

export default router;
