import express from 'express';
import rateLimit from 'express-rate-limit';
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
  getUserStats,
  getSessions,
  logoutDevice,
  logoutAllDevices
} from '../controllers/userController';
import { protect, admin } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts from this IP, please try again after 15 minutes' }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many OTP requests from this IP, please try again after 15 minutes' }
});

router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.get('/', protect, admin, getUsers);
router.get('/stats', internalAuth, getUserStats);
router.post('/batch', internalAuth, getUsersBatch);
router.get('/:id', protect, getUserById);
router.post('/register', loginLimiter, registerUser);
router.post('/login', loginLimiter, loginUser);
router.post('/refresh', refreshUserToken);
router.post('/logout', logoutUser);

router.get('/sessions', protect, getSessions);
router.delete('/sessions/:sessionId', protect, logoutDevice);
router.delete('/sessions', protect, logoutAllDevices);

router.post('/send-otp', otpLimiter, sendOtp);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/verify-reset-otp', otpLimiter, verifyResetOtp);
router.post('/reset-password', otpLimiter, resetPassword);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
