import express from 'express';
import {
  getCategories,
  getHomeBundle,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/',           getCategories);
router.get('/home-bundle', getHomeBundle);
router.get('/:id',        getCategoryById);
router.post('/',    protect, admin, createCategory);
router.put('/:id',  protect, admin, updateCategory);
router.delete('/:id', protect, admin, deleteCategory);

export default router;
