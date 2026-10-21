import { Request, Response } from 'express';
import { UserRepository } from '../../repositories/userRepository';
import { OtpRepository } from '../../repositories/otpRepository';
import { RefreshTokenRepository } from '../../repositories/refreshTokenRepository';
import { generateAccessToken, generateRefreshToken, getRefreshTokenMaxAgeMs } from '../../utils/generateToken';
import { enforceSessionLimit } from '../../utils/sessionHelper';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendMsg91SmsOtp, sendMsg91EmailOtp, verifyMsg91Otp } from '../../utils/msg91';
import { issueSession, sessionResponse } from '../../services/sessionService';

// Helper to dynamically get nodemailer transport using current environment variables
const getTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const OTP_PEPPER = process.env.OTP_PEPPER || 'bharatclap_secure_otp_pepper_2026';
const ALLOWED_PURPOSES = ['LOGIN_REGISTRATION', 'PHONE_CHANGE', 'PASSWORD_RESET', 'ACCOUNT_DELETION'];

export function hashOtp(otp: string, identifier: string): string {
  return crypto.createHmac('sha256', OTP_PEPPER).update(`${identifier}:${otp}`).digest('hex');
}

import { normalizeIdentifier, normalizeCanonicalPhone } from '../../utils/phoneUtils';
export { normalizeIdentifier, normalizeCanonicalPhone };

// @desc    Send OTP for registration/login
// @route   POST /api/users/send-otp
// @access  Public
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier: rawIdentifier, role, useEmail, mode, purpose: rawPurpose } = req.body;

    const identifier = normalizeIdentifier(String(rawIdentifier || ''), Boolean(useEmail));
    if (!identifier) {
      res.status(400).json({
        message: useEmail
          ? 'Invalid email address provided.'
          : 'Invalid mobile number. Please provide a valid 10-digit Indian mobile number.'
      });
      return;
    }
    const purpose = String(rawPurpose || (mode === 'forgot-password' ? 'PASSWORD_RESET' : 'LOGIN_REGISTRATION')).toUpperCase();

    if (!ALLOWED_PURPOSES.includes(purpose)) {
      res.status(400).json({ message: 'Invalid OTP purpose specified.' });
      return;
    }

    const existingUser = useEmail
      ? await UserRepository.findByEmail(identifier)
      : await UserRepository.findByPhone(identifier);

    if (mode === 'register' && existingUser) {
      if (useEmail) {
        res.status(400).json({ message: 'This email is already registered.' });
      } else {
        res.status(400).json({ message: 'This mobile number is already registered.' });
      }
      return;
    }

    if (mode === 'forgot-password' && !existingUser) {
      res.status(404).json({ message: 'No account found with this identifier.' });
      return;
    }

    // For update mode: block only if another user owns the identifier
    if (mode === 'update' && existingUser) {
      const currentUserId = (req as any).user?._id || (req as any).user?.id;
      const isSameUser = currentUserId && (existingUser.id === currentUserId || existingUser.legacy_mongo_id === currentUserId);
      if (!isSameUser) {
        res.status(400).json({
          message: `This ${useEmail ? 'email address' : 'phone number'} is already registered to another account.`
        });
        return;
      }
    }

    // Enforce 30-second Server-side Resend Cooldown
    const latestOtp = await OtpRepository.findLatest(identifier, purpose);
    if (latestOtp) {
      const createdAtMs = new Date(latestOtp.created_at).getTime();
      const elapsedMs = Date.now() - createdAtMs;
      if (elapsedMs < 30000) {
        const waitSec = Math.ceil((30000 - elapsedMs) / 1000);
        res.status(429).json({
          message: `Please wait ${waitSec}s before requesting a new OTP.`,
          retryAfter: waitSec,
        });
        return;
      }
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(otpCode, identifier);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await OtpRepository.createChallenge({
      identifier,
      purpose,
      otpHash,
      role: role || 'customer',
      expiresAt,
    });

    if (useEmail) {
      const mailOptions = {
        from: `"BharatClap Verification" <${process.env.SMTP_EMAIL}>`,
        to: identifier,
        subject: 'BharatClap Verification OTP',
        text: `Your BharatClap Verification OTP is: ${otpCode}. If you didn't request this, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #1D2B83; text-align: center;">BharatClap Verification</h2>
            <p>Hello,</p>
            <p>Please use the verification code below to securely log into your account.</p>
            <div style="background-color: #F8F9FC; padding: 15px; text-align: center; border-radius: 10px; margin: 20px 0;">
              <h1 style="font-size: 32px; letter-spacing: 8px; color: #1D2B83; margin: 0;">${otpCode}</h1>
            </div>
            <p style="color: #666; font-size: 14px;">If you didn't request this OTP, please ignore this email.</p>
          </div>
        `,
      };

      let sentViaMsg91 = false;
      // 1. Try MSG91 Email API if MSG91_EMAIL_TEMPLATE_ID is configured
      if (process.env.MSG91_AUTHKEY && process.env.MSG91_EMAIL_TEMPLATE_ID) {
        const msg91Res = await sendMsg91EmailOtp(identifier, otpCode);
        if (msg91Res.success) {
          sentViaMsg91 = true;
          console.log(`[SUCCESS] Email OTP sent via MSG91 to ${identifier}`);
        } else {
          console.warn('[MSG91 EMAIL] Delivery failed, trying SMTP fallback:', msg91Res.error);
        }
      }

      // 2. Fallback to SMTP if MSG91 Email not used
      if (!sentViaMsg91) {
        if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
          try {
            await getTransporter().sendMail(mailOptions);
            console.log(`[SUCCESS] Email OTP sent via SMTP to ${identifier}`);
          } catch (emailError: any) {
            console.error('[SMTP ERROR] Failed to send email OTP:', emailError?.message || emailError);
          }
        } else {
          console.log(`[MOCK EMAIL] Configure MSG91_EMAIL_TEMPLATE_ID or SMTP in .env. OTP dispatched to ${identifier}`);
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV OTP CODE] Code for ${identifier}: ${otpCode}`);
      }
    } else {
      // SMS OTP via MSG91 API v5
      await sendMsg91SmsOtp(identifier, otpCode);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV OTP SMS] Code for ${identifier}: ${otpCode}`);
      }
    }

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP
// @route   POST /api/users/verify-otp
// @access  Public
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier: rawIdentifier, otp, useEmail, purpose: rawPurpose } = req.body;

    const safeIdentifier = normalizeIdentifier(String(rawIdentifier || ''), Boolean(useEmail));
    const safeOtp = String(otp || '').trim();
    const safePurpose = String(rawPurpose || 'LOGIN_REGISTRATION').toUpperCase();

    if (!ALLOWED_PURPOSES.includes(safePurpose)) {
      res.status(400).json({ message: 'Invalid OTP purpose.' });
      return;
    }

    // 1. Find challenge by identifier + purpose
    const otpRecord = await OtpRepository.findActive(safeIdentifier, safePurpose);

    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP.' });
      return;
    }

    if (otpRecord.status === 'locked') {
      res.status(429).json({ message: 'This OTP challenge is locked due to too many failed attempts. Please request a new OTP.' });
      return;
    }

    if (otpRecord.status !== 'active') {
      res.status(400).json({ message: 'OTP already consumed or expired.' });
      return;
    }

    // 2. Application-Level Expiry Check (300 seconds)
    const createdAtMs = new Date(otpRecord.created_at).getTime();
    const ageMs = Date.now() - createdAtMs;
    if (ageMs > 300000) {
      await OtpRepository.consume(otpRecord.id);
      res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
      return;
    }

    // 3. Timing-Safe HMAC verification
    const expectedHash = otpRecord.otp_hash;
    const submittedHash = hashOtp(safeOtp, safeIdentifier);

    const expectedBuf = Buffer.from(expectedHash, 'utf8');
    const submittedBuf = Buffer.from(submittedHash, 'utf8');

    const isMatch =
      expectedBuf.length === submittedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, submittedBuf);

    if (isMatch) {
      // 4. Correct-OTP Atomic CAS Claim
      await OtpRepository.consume(otpRecord.id);

      let existingUser = useEmail
        ? await UserRepository.findByEmail(safeIdentifier)
        : await UserRepository.findByPhone(safeIdentifier);

      // Auto-register customer if first-time OTP verification
      if (!existingUser && (!otpRecord.role || otpRecord.role === 'customer')) {
        let referralCode = '';
        let isUnique = false;
        while (!isUnique) {
          const rand = Math.floor(100 + Math.random() * 900);
          referralCode = `USER${rand}`;
          const existing = await UserRepository.findByReferralCode(referralCode);
          if (!existing) isUnique = true;
        }

        existingUser = await UserRepository.create({
          name: '',
          phone: !useEmail ? safeIdentifier : null,
          email: useEmail ? safeIdentifier : null,
          role: 'customer',
          is_phone_verified: !useEmail,
          is_email_verified: Boolean(useEmail),
          referral_code: referralCode,
        });
      }

      if (existingUser) {
        if (existingUser.isDeleted || existingUser.status === 'blocked') {
          res.status(403).json({ message: 'Account is suspended or has been deleted. Please contact support.' });
          return;
        }

        // Portal check: if OTP was requested from the provider page, reject non-providers
        if (otpRecord.role === 'provider' && existingUser.role !== 'provider') {
          res.status(403).json({ message: 'This account is not a provider account.' });
          return;
        }

        const updateField = useEmail ? { is_email_verified: true } : { is_phone_verified: true };
        await UserRepository.update(existingUser.id, updateField);
        await UserRepository.recordLogin(existingUser.id);

        const tokenBody = await issueSession(req, res, existingUser);
        res.status(200).json({
          message: 'OTP verified successfully (Login)',
          ...sessionResponse(existingUser, tokenBody),
        });
        return;
      } else {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is not set');
        }
        const verificationToken = jwt.sign(
          {
            type: 'registration_proof',
            identifier: safeIdentifier,
            role: otpRecord.role === 'provider' ? 'provider' : 'customer',
          },
          secret,
          { expiresIn: '15m' }
        );

        res.status(200).json({
          message: 'OTP verified successfully (New User)',
          verificationToken,
          user: {
            _id: "pending_verification",
            id: "pending_verification",
            role: otpRecord.role,
            email: useEmail ? safeIdentifier : "",
            phone: !useEmail ? safeIdentifier : "",
            token: "pending_auth_token",
          }
        });
      }
      return;
    }

    // 5. Wrong-OTP: Increment attempts and lock if >= 5
    const newAttempts = await OtpRepository.incrementAttempts(otpRecord.id);
    if (newAttempts >= 5) {
      await OtpRepository.lock(otpRecord.id);
      res.status(429).json({ message: 'Too many failed attempts. This OTP challenge is now locked. Please request a new OTP.' });
      return;
    }

    const remaining = Math.max(0, 5 - newAttempts);
    res.status(400).json({ message: `Invalid OTP. Please try again. (${remaining} attempts remaining)` });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/users/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawIdentifier = req.body.identifier || req.body.email || req.body.phone;
    const isEmail = String(rawIdentifier || '').includes('@');
    const identifier = normalizeIdentifier(String(rawIdentifier || ''), isEmail);

    const user = isEmail
      ? await UserRepository.findByEmail(identifier)
      : await UserRepository.findByPhone(identifier);

    if (!user) {
      res.status(404).json({ message: `User with this ${isEmail ? 'email' : 'phone number'} does not exist.` });
      return;
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(otpCode, identifier);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpRepository.createChallenge({
      identifier,
      purpose: 'PASSWORD_RESET',
      otpHash,
      role: user.role || 'customer',
      expiresAt,
    });

    if (isEmail) {
      const mailOptions = {
        from: `"BharatClap Verification" <${process.env.SMTP_EMAIL}>`,
        to: identifier,
        subject: 'Reset Your Password - BharatClap',
        text: `Your password reset code is: ${otpCode}. If you didn't request this, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #1D2B83; text-align: center;">Password Reset Request</h2>
            <p>Hello,</p>
            <p>We received a request to reset your password. Use the code below to proceed:</p>
            <div style="background-color: #F8F9FC; padding: 15px; text-align: center; border-radius: 10px; margin: 20px 0;">
              <h1 style="font-size: 32px; letter-spacing: 8px; color: #1D2B83; margin: 0;">${otpCode}</h1>
            </div>
            <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      };

      let sentViaMsg91 = false;
      if (process.env.MSG91_AUTHKEY && process.env.MSG91_EMAIL_TEMPLATE_ID) {
        const msg91Res = await sendMsg91EmailOtp(identifier, otpCode);
        if (msg91Res.success) {
          sentViaMsg91 = true;
          console.log(`[SUCCESS] Reset OTP sent via MSG91 to ${identifier}`);
        }
      }

      if (!sentViaMsg91) {
        if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
          try {
            await getTransporter().sendMail(mailOptions);
            console.log(`[SUCCESS] Email OTP sent to ${identifier}`);
          } catch (emailError: any) {
            console.error('[SMTP ERROR] Failed to send reset password email:', emailError?.message || emailError);
          }
        } else {
          console.log(`[MOCK EMAIL] Password reset OTP dispatched to ${identifier}: ${otpCode}`);
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV OTP RESET CODE] Code for ${identifier}: ${otpCode}`);
      }
    } else {
      await sendMsg91SmsOtp(identifier, otpCode);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV OTP SMS RESET CODE] Code for ${identifier}: ${otpCode}`);
      }
    }

    res.status(200).json({ message: `OTP sent to your ${isEmail ? 'email' : 'phone number'}` });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP for Reset Password (Step 2)
// @route   POST /api/users/verify-reset-otp
// @access  Public
export const verifyResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawIdentifier = req.body.identifier || req.body.email || req.body.phone;
    const isEmail = String(rawIdentifier || '').includes('@');
    const identifier = normalizeIdentifier(String(rawIdentifier || ''), isEmail);
    const safeOtp = String(req.body.otp || '').trim();

    const otpRecord = await OtpRepository.findActive(identifier, 'PASSWORD_RESET');

    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP.' });
      return;
    }

    if (otpRecord.status === 'locked') {
      res.status(429).json({ message: 'This OTP challenge is locked due to too many failed attempts. Please request a new OTP.' });
      return;
    }

    if (otpRecord.status !== 'active') {
      res.status(400).json({ message: 'OTP already consumed or expired.' });
      return;
    }

    const createdAtMs = new Date(otpRecord.created_at).getTime();
    const ageMs = Date.now() - createdAtMs;
    if (ageMs > 300000) {
      await OtpRepository.consume(otpRecord.id);
      res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
      return;
    }

    const expectedHash = otpRecord.otp_hash;
    const submittedHash = hashOtp(safeOtp, identifier);
    const expectedBuf = Buffer.from(expectedHash, 'utf8');
    const submittedBuf = Buffer.from(submittedHash, 'utf8');

    const isMatch =
      expectedBuf.length === submittedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, submittedBuf);

    if (!isMatch) {
      const newAttempts = await OtpRepository.incrementAttempts(otpRecord.id);
      if (newAttempts >= 5) {
        await OtpRepository.lock(otpRecord.id);
        res.status(429).json({ message: 'Too many failed attempts. This OTP challenge is now locked. Please request a new OTP.' });
        return;
      }
      const remaining = Math.max(0, 5 - newAttempts);
      res.status(400).json({ message: `Invalid OTP code. (${remaining} attempts remaining)` });
      return;
    }

    res.status(200).json({ message: 'OTP verified. Please set your new password.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset Password (Step 3)
// @route   POST /api/users/reset-password
// @access  Public
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawIdentifier = req.body.identifier || req.body.email || req.body.phone;
    const isEmail = String(rawIdentifier || '').includes('@');
    const identifier = normalizeIdentifier(String(rawIdentifier || ''), isEmail);
    const safeOtp = String(req.body.otp || '').trim();
    const password = req.body.password;

    const otpRecord = await OtpRepository.findActive(identifier, 'PASSWORD_RESET');
    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP. Please start over.' });
      return;
    }

    if (otpRecord.status === 'locked') {
      res.status(429).json({ message: 'This OTP challenge is locked due to too many failed attempts. Please request a new OTP.' });
      return;
    }

    if (otpRecord.status !== 'active') {
      res.status(400).json({ message: 'OTP already consumed or expired.' });
      return;
    }

    const createdAtMs = new Date(otpRecord.created_at).getTime();
    const ageMs = Date.now() - createdAtMs;
    if (ageMs > 300000) {
      await OtpRepository.consume(otpRecord.id);
      res.status(400).json({ message: 'OTP has expired. Please start over.' });
      return;
    }

    const expectedHash = otpRecord.otp_hash;
    const submittedHash = hashOtp(safeOtp, identifier);
    const expectedBuf = Buffer.from(expectedHash, 'utf8');
    const submittedBuf = Buffer.from(submittedHash, 'utf8');

    const isMatch =
      expectedBuf.length === submittedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, submittedBuf);

    if (!isMatch) {
      const newAttempts = await OtpRepository.incrementAttempts(otpRecord.id);
      if (newAttempts >= 5) {
        await OtpRepository.lock(otpRecord.id);
        res.status(429).json({ message: 'Too many failed attempts. This OTP challenge is now locked. Please request a new OTP.' });
        return;
      }
      const remaining = Math.max(0, 5 - newAttempts);
      res.status(400).json({ message: `Invalid OTP code. (${remaining} attempts remaining)` });
      return;
    }

    // Atomic CAS claim
    await OtpRepository.consume(otpRecord.id);

    const user = isEmail
      ? await UserRepository.findByEmail(identifier)
      : await UserRepository.findByPhone(identifier);

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    await UserRepository.update(user.id, { password_hash: passwordHash });

    res.status(200).json({ message: 'Password reset successful. You can now log in.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
