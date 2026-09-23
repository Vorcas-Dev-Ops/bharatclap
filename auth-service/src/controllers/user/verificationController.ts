import { Request, Response } from 'express';
import { UserRepository } from '../../repositories/userRepository';
import { OtpRepository } from '../../repositories/otpRepository';
import { RefreshTokenRepository } from '../../repositories/refreshTokenRepository';
import { generateAccessToken, generateRefreshToken, getRefreshTokenMaxAgeMs } from '../../utils/generateToken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import axios from 'axios';
import crypto from 'crypto';

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

export function normalizeIdentifier(raw: string, isEmail?: boolean): string {
  if (!raw) return '';
  const trimmed = raw.trim().toLowerCase();
  if (isEmail) return trimmed;
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 10) return `+91${digitsOnly}`;
  if (digitsOnly.startsWith('91') && digitsOnly.length === 12) return `+${digitsOnly}`;
  if (trimmed.startsWith('+')) return trimmed;
  return `+${digitsOnly}`;
}

// @desc    Send OTP for registration/login
// @route   POST /api/users/send-otp
// @access  Public
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier: rawIdentifier, role, useEmail, mode, purpose: rawPurpose } = req.body;

    const identifier = normalizeIdentifier(String(rawIdentifier || ''), Boolean(useEmail));
    const purpose = String(rawPurpose || (mode === 'forgot-password' ? 'PASSWORD_RESET' : 'LOGIN_REGISTRATION')).toUpperCase();

    if (!ALLOWED_PURPOSES.includes(purpose)) {
      res.status(400).json({ message: 'Invalid OTP purpose specified.' });
      return;
    }

    const existingUser = useEmail
      ? await UserRepository.findByEmail(identifier)
      : await UserRepository.findByPhone(identifier);

    if (mode === 'register' && existingUser) {
      res.status(400).json({ message: 'This email or phone is already registered. Please log in instead.' });
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

      try {
        if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
          await getTransporter().sendMail(mailOptions);
          console.log(`[SUCCESS] Email OTP sent to ${identifier}`);
        } else {
          /* ponytail: P0-2 PII logging audit - mask OTP in dev logs */
          console.log(`[MOCK EMAIL] Setup SMTP_EMAIL && SMTP_PASSWORD in .env to send real email. OTP dispatched to ${identifier}`);
        }
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }
    } else {
      if (process.env.MSG91_AUTHKEY && process.env.MSG91_TEMPLATE_ID) {
        try {
          const mobile = identifier.replace(/^\+/, '');
          const formattedMobile = mobile.startsWith('91') ? mobile : `91${mobile}`;

          const msg91Res = await axios.post(
            'https://control.msg91.com/api/v5/otp',
            { OTP: otpCode },
            {
              params: {
                authkey: process.env.MSG91_AUTHKEY,
                template_id: process.env.MSG91_TEMPLATE_ID,
                mobile: formattedMobile,
              },
              headers: { 'Content-Type': 'application/json' },
              timeout: 5000,
            }
          );

          if (msg91Res.data?.type === 'error') {
            console.error('[MSG91 DLT/API REJECTION]', msg91Res.data);
          } else {
            console.log(`[SUCCESS] SMS OTP sent via MSG91 to ${formattedMobile}`);
          }
        } catch (smsError: any) {
          console.error('[MSG91] Failed to send SMS:', smsError?.response?.data || smsError?.message);
        }
      } else {
        /* ponytail: P0-2 PII logging audit - mask OTP in dev logs */
        console.log(`[MOCK SMS] Set MSG91_AUTHKEY + MSG91_TEMPLATE_ID in .env to send real SMS. OTP dispatched to ${identifier}`);
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

      const existingUser = useEmail
        ? await UserRepository.findByEmail(safeIdentifier)
        : await UserRepository.findByPhone(safeIdentifier);

      if (existingUser) {
        const updateField = useEmail ? { is_email_verified: true } : { is_phone_verified: true };
        await UserRepository.update(existingUser.id, updateField);

        const refreshToken = generateRefreshToken(existingUser.id, existingUser.role);
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const maxAgeMs = getRefreshTokenMaxAgeMs(existingUser.role);

        await RefreshTokenRepository.saveToken({
          userId: existingUser.id,
          tokenHash,
          deviceInfo: (req.headers['user-agent'] as string) || 'Unknown Device',
          ipAddress: req.ip || 'Unknown IP',
          expiresAt: new Date(Date.now() + maxAgeMs),
        });

        res.cookie('jwt', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          sameSite: 'strict',
          maxAge: maxAgeMs
        });

        res.status(200).json({
          message: 'OTP verified successfully (Login)',
          user: {
            _id: existingUser.id,
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            phone: existingUser.phone,
            role: existingUser.role,
            gender: existingUser.gender,
            profile_image: existingUser.profile_image,
            token: generateAccessToken(existingUser.id, existingUser.role),
          }
        });
      } else {
        res.status(200).json({
          message: 'OTP verified successfully (New User)',
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
    const { email: rawEmail } = req.body;
    const email = normalizeIdentifier(String(rawEmail || ''), true);
    const user = await UserRepository.findByEmail(email);

    if (!user) {
      res.status(404).json({ message: 'User with this email does not exist.' });
      return;
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(otpCode, email);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpRepository.createChallenge({
      identifier: email,
      purpose: 'PASSWORD_RESET',
      otpHash,
      role: user.role || 'customer',
      expiresAt,
    });

    const mailOptions = {
      from: `"BharatClap Verification" <${process.env.SMTP_EMAIL}>`,
      to: email,
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

    if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
      await getTransporter().sendMail(mailOptions);
    }

    res.status(200).json({ message: 'OTP sent to your email' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP for Reset Password (Step 2)
// @route   POST /api/users/verify-reset-otp
// @access  Public
export const verifyResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email: rawEmail, otp } = req.body;
    const email = normalizeIdentifier(String(rawEmail || ''), true);
    const safeOtp = String(otp || '').trim();

    const otpRecord = await OtpRepository.findActive(email, 'PASSWORD_RESET');

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
    const submittedHash = hashOtp(safeOtp, email);
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
    const { email: rawEmail, otp, password } = req.body;
    const email = normalizeIdentifier(String(rawEmail || ''), true);
    const safeOtp = String(otp || '').trim();

    const otpRecord = await OtpRepository.findActive(email, 'PASSWORD_RESET');
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
    const submittedHash = hashOtp(safeOtp, email);
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

    const user = await UserRepository.findByEmail(email);
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
