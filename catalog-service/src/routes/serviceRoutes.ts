import express from 'express';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} from '../controllers/serviceController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/',     getServices);
router.get('/:id',  getServiceById);
router.post('/',    protect, admin, createService);
router.put('/:id',  protect, admin, updateService);
router.delete('/:id', protect, admin, deleteService);

export default router;
