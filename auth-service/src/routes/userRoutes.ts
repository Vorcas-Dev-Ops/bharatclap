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
  logoutAllDevices,
  googleLogin
} from '../controllers/userController';
import { protect, admin } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import {
  validate,
  registerSchema,
  loginSchema,
  updateMeSchema,
  sendOtpSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema
} from '../middleware/validate';

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
router.put('/me', protect, validate(updateMeSchema), updateMe);
router.get('/', protect, admin, getUsers);
router.get('/stats', internalAuth, getUserStats);
router.post('/batch', internalAuth, getUsersBatch);
router.get('/:id', protect, getUserById);
router.post('/register', loginLimiter, validate(registerSchema), registerUser);
router.post('/login', loginLimiter, validate(loginSchema), loginUser);
router.post('/google-login', loginLimiter, googleLogin);
router.post('/refresh', refreshUserToken);
router.post('/logout', logoutUser);

router.get('/sessions', protect, getSessions);
router.delete('/sessions/:sessionId', protect, logoutDevice);
router.delete('/sessions', protect, logoutAllDevices);

router.post('/send-otp', otpLimiter, validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', otpLimiter, validate(verifyOtpSchema), verifyOtp);
router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/verify-reset-otp', otpLimiter, validate(verifyResetOtpSchema), verifyResetOtp);
router.post('/reset-password', otpLimiter, validate(resetPasswordSchema), resetPassword);
router.put('/:id', protect, admin, updateUser);
router.delete('/:id', protect, admin, deleteUser);

export default router;
