import express from 'express';
import {
  getAccessories,
  getAccessoryById,
  createAccessory,
  updateAccessory,
  deleteAccessory,
} from '../controllers/accessoryController';

const router = express.Router();

router.get('/', getAccessories);
router.get('/:id', getAccessoryById);
router.post('/', createAccessory);
router.put('/:id', updateAccessory);
router.delete('/:id', deleteAccessory);

export default router;
