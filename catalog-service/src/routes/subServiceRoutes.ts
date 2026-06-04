import express from 'express';
import {
  getSubServices,
  getSubServiceById,
  createSubService,
  updateSubService,
  deleteSubService,
} from '../controllers/subServiceController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/',     getSubServices);
router.get('/:id',  getSubServiceById);
router.post('/',    protect, admin, createSubService);
router.put('/:id',  protect, admin, updateSubService);
router.delete('/:id', protect, admin, deleteSubService);

export default router;
