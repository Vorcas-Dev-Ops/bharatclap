import express from 'express';
import { getAddresses, addAddress, updateAddress, deleteAddress, getAddressesBatch } from '../controllers/addressController';
import { protect } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

router.post('/batch', internalAuth, getAddressesBatch);

router.route('/')
  .get(protect, getAddresses)
  .post(protect, addAddress);

router.route('/:id')
  .put(protect, updateAddress)
  .delete(protect, deleteAddress);

export default router;
