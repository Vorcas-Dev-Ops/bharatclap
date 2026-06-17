import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getMe, 
  updateMe, 
  getUsers, 
  getUserById,
  deleteUser, 
  updateUser, 
  sendOtp, 
  verifyOtp, 
  forgotPassword, 
  resetPassword, 
  verifyResetOtp,
  refreshUserToken,
  logoutUser,
  getUsersBatch,
  getUserStats
} from '../controllers/userController';
import { protect } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.get('/', getUsers);
router.get('/stats', internalAuth, getUserStats);
router.post('/batch', internalAuth, getUsersBatch);
router.get('/:id', getUserById);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshUserToken);
router.post('/logout', logoutUser);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
