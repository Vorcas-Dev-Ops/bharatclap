import express from 'express';
import rateLimit from 'express-rate-limit';
import { registerUser, loginUser, refreshUserToken, logoutUser, googleLogin } from '../controllers/user/authController';
import { sendOtp, verifyOtp, forgotPassword, verifyResetOtp, resetPassword } from '../controllers/user/verificationController';
import { getMe, updateMe, checkAvailability } from '../controllers/user/profileController';
import { getSessions, logoutDevice, logoutAllDevices } from '../controllers/user/sessionController';
import { getMyReferralCode, verifyReferralCode, getReferralHistory, onBookingCompletedInternal } from '../controllers/user/referralController';
import { getUsers, getUserById, getUserStats, getUsersBatch, updateUser, deleteUser, getAdminActivityLogs, createAdminActivityLogInternal, searchUsersInternal } from '../controllers/user/managementController';
import { requestOtp as phoneChangeRequestOtp, verifyOtp as phoneChangeVerifyOtp, getStatus as phoneChangeStatus } from '../controllers/user/phoneChangeController';
import { protect, admin, checkPermission, optionalProtect } from '../middleware/authMiddleware';
import { internalAuth } from '../middleware/internalAuth';
import { otpAbuseProtection } from '../middleware/otpAbuseProtection';
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

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 1000,
  message: { message: 'Too many token refresh attempts from this IP, please try again later' }
});

import { requestAccountDeletion, cancelAccountDeletion, exportUserData } from '../controllers/user/privacyController';
import {
  requestWebDeletionOtp,
  verifyWebDeletionOtp,
  initiateAccountDeletion,
  getDeletionStatus,
  getUserDeletionStatusInternal,
  getAdminDeletionRequests,
  adminClearFinancialAction,
} from '../controllers/accountDeletionController';

// Google Play Specification Account Deletion Routes
router.post('/deletion/request-otp', otpLimiter, otpAbuseProtection, requestWebDeletionOtp);
router.post('/deletion/verify-otp', verifyWebDeletionOtp);
router.post('/deletion/initiate', optionalProtect, initiateAccountDeletion);
router.get('/deletion/status/:requestId', getDeletionStatus);
router.get('/internal/users/:userId/deletion-status', internalAuth, getUserDeletionStatusInternal);
router.get('/admin/deletion-requests', protect, admin, getAdminDeletionRequests);
router.post('/admin/deletion-requests/:requestId/financial-action', protect, admin, adminClearFinancialAction);

router.get('/me', protect, getMe);
router.put('/me', protect, validate(updateMeSchema), updateMe);
router.post('/me/delete-request', protect, requestAccountDeletion);
router.delete('/me/delete-request', protect, cancelAccountDeletion);
router.get('/me/data-export', protect, exportUserData);
router.post('/check-availability', protect, checkAvailability);
router.get('/admin-activity-logs', protect, admin, checkPermission('settings', 'view'), getAdminActivityLogs);
router.post('/internal/admin-activity-log', internalAuth, createAdminActivityLogInternal);
router.get('/', protect, admin, checkPermission('users', 'view'), getUsers);
router.get('/stats', internalAuth, getUserStats);
router.post('/internal/search', internalAuth, searchUsersInternal);
router.post('/batch', internalAuth, getUsersBatch);

// Phone Number Change (authenticated, rate-limited)
router.get('/phone/change/status', protect, phoneChangeStatus);
router.post('/phone/change/request-otp', otpLimiter, otpAbuseProtection, protect, phoneChangeRequestOtp);
router.post('/phone/change/verify-otp', otpLimiter, protect, phoneChangeVerifyOtp);

router.get('/:id', protect, getUserById);
router.post('/register', loginLimiter, validate(registerSchema), registerUser);
router.post('/login', loginLimiter, validate(loginSchema), loginUser);
router.post('/google-login', loginLimiter, googleLogin);
router.post('/refresh', refreshLimiter, refreshUserToken);
router.post('/logout', logoutUser);

router.get('/sessions', protect, getSessions);
router.delete('/sessions/:sessionId', protect, logoutDevice);
router.delete('/sessions', protect, logoutAllDevices);

router.post('/send-otp', otpLimiter, otpAbuseProtection, optionalProtect, validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', otpLimiter, validate(verifyOtpSchema), verifyOtp);
router.post('/forgot-password', otpLimiter, otpAbuseProtection, validate(forgotPasswordSchema), forgotPassword);
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
