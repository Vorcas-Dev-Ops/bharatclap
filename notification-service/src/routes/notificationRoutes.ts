import express from 'express';
import { 
  getNotifications, markAsRead, deleteNotification, createNotification, enqueueNotification,
  getAdminNotifications, markAdminAsRead, deleteAdminNotification
} from '../controllers/notificationController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// Admin routes (must be before /:id routes to avoid matching 'admin' as an id)
router.get('/admin', protect, admin, getAdminNotifications);
router.put('/admin/:id/read', protect, admin, markAdminAsRead);
router.delete('/admin/:id', protect, admin, deleteAdminNotification);

router.route('/')
  .get(protect, getNotifications)
  .post(createNotification); // Internal access allowed, no auth middleware needed

router.post('/enqueue', enqueueNotification);

router.put('/:id/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);

export default router;
