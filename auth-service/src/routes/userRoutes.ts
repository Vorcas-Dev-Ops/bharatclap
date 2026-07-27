import express from 'express';
import rateLimit from 'express-rate-limit';
import { registerUser, loginUser, refreshUserToken, logoutUser, googleLogin } from '../controllers/user/authController';
import { sendOtp, verifyOtp, forgotPassword, verifyResetOtp, resetPassword } from '../controllers/user/verificationController';
import { getMe, updateMe } from '../controllers/user/profileController';
import { getSessions, logoutDevice, logoutAllDevices } from '../controllers/user/sessionController';
import { getMyReferralCode, verifyReferralCode, getReferralHistory, onBookingCompletedInternal } from '../controllers/user/referralController';
import { getUsers, getUserById, getUserStats, getUsersBatch, updateUser, deleteUser, getAdminActivityLogs, createAdminActivityLogInternal } from '../controllers/user/managementController';
import { protect, admin, checkPermission } from '../middleware/authMiddleware';
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

const isProd = process.env.NODE_ENV === 'production';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 500,
  message: { message: 'Too many login attempts from this IP, please try again after 15 minutes' }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 5 : 200,
  message: { message: 'Too many OTP requests from this IP, please try again after 15 minutes' }
});

router.get('/me', protect, getMe);
router.put('/me', protect, validate(updateMeSchema), updateMe);
router.get('/admin-activity-logs', protect, admin, checkPermission('settings', 'view'), getAdminActivityLogs);
router.post('/internal/admin-activity-log', internalAuth, createAdminActivityLogInternal);
router.get('/', protect, admin, checkPermission('users', 'view'), getUsers);
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

// Referral Public/Protected routes
router.get('/referrals/my-code', protect, getMyReferralCode);
router.post('/referrals/verify', verifyReferralCode);
router.get('/referrals/history', protect, getReferralHistory);

// Referral Internal routes
router.post('/referrals/internal/on-booking-completed', internalAuth, onBookingCompletedInternal);

export default router;
