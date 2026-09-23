import { Request, Response } from 'express';
import { User } from '../../models/User';
import { Otp } from '../../models/Otp';
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

    const existingUser = await User.findOne(useEmail ? { email: identifier } : { phone: identifier });

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
      const currentUserId = (req as any).user?._id;
      const isSameUser = currentUserId && existingUser._id.toString() === currentUserId.toString();
      if (!isSameUser) {
        res.status(400).json({
          message: `This ${useEmail ? 'email address' : 'phone number'} is already registered to another account.`
        });
        return;
      }
    }

    // Enforce 30-second Server-side Resend Cooldown
    const existingOtp = await Otp.findOne({ identifier, purpose, status: 'active' });
    if (existingOtp) {
      const elapsedMs = Date.now() - existingOtp.createdAt.getTime();
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

    // Atomically replace/create challenge
    await Otp.findOneAndUpdate(
      { identifier, purpose },
      {
        $set: {
          otpHash,
          role: role || 'customer',
          status: 'active',
          attempts: 0,
          consumedAt: undefined,
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

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
          // MSG91 v5 OTP API — phone must be 91XXXXXXXXXX (no +)
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
    const otpRecord = await Otp.findOne({ identifier: safeIdentifier, purpose: safePurpose });

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
    const ageMs = Date.now() - otpRecord.createdAt.getTime();
    if (ageMs > 300000) {
      await Otp.updateOne({ _id: otpRecord._id }, { $set: { status: 'consumed' } });
      res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
      return;
    }

    // 3. Timing-Safe HMAC verification
    const expectedHash = otpRecord.otpHash || (otpRecord.otpCode ? hashOtp(otpRecord.otpCode, safeIdentifier) : '');
    const submittedHash = hashOtp(safeOtp, safeIdentifier);

    const expectedBuf = Buffer.from(expectedHash, 'utf8');
    const submittedBuf = Buffer.from(submittedHash, 'utf8');

    const isMatch =
      expectedBuf.length === submittedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, submittedBuf);

    if (isMatch) {
      // 4. Correct-OTP Atomic CAS Claim
      const claimed = await Otp.findOneAndUpdate(
        { _id: otpRecord._id, status: 'active' },
        { $set: { status: 'consumed', consumedAt: new Date() } },
        { new: true }
      );

      if (!claimed) {
        res.status(400).json({ message: 'OTP already consumed or expired.' });
        return;
      }

      const existingUser = await User.findOne(useEmail ? { email: safeIdentifier } : { phone: safeIdentifier });

      if (existingUser) {
        if (useEmail) {
          existingUser.isEmailVerified = true;
        } else {
          existingUser.isPhoneVerified = true;
        }
        await existingUser.save();

        const refreshToken = generateRefreshToken(existingUser._id.toString(), existingUser.role);
        const maxAgeMs = getRefreshTokenMaxAgeMs(existingUser.role);
        res.cookie('jwt', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          sameSite: 'strict',
          maxAge: maxAgeMs
        });

        res.status(200).json({
          message: 'OTP verified successfully (Login)',
          user: {
            _id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            phone: existingUser.phone,
            role: existingUser.role,
            gender: existingUser.gender,
            profile_image: existingUser.profile_image,
            token: generateAccessToken(existingUser._id.toString(), existingUser.role),
          }
        });
      } else {
        res.status(200).json({
          message: 'OTP verified successfully (New User)',
          user: {
            _id: "pending_verification",
            role: otpRecord.role,
            email: useEmail ? safeIdentifier : "",
            phone: !useEmail ? safeIdentifier : "",
            token: "pending_auth_token",
          }
        });
      }
      return;
    }

    // 5. Wrong-OTP: Atomic pipeline update incrementing attempts and setting status=locked on 5th attempt
    const updatedOtp = await Otp.findOneAndUpdate(
      { _id: otpRecord._id, status: 'active' },
      [
        { $set: { attempts: { $add: ['$attempts', 1] } } },
        {
          $set: {
            status: { $cond: [{ $gte: ['$attempts', 5] }, 'locked', 'active'] },
            lockedAt: { $cond: [{ $gte: ['$attempts', 5] }, new Date(), '$$REMOVE'] }
          }
        }
      ],
      { new: true }
    );

    if (!updatedOtp) {
      res.status(400).json({ message: 'Invalid or already used OTP.' });
      return;
    }

    if (updatedOtp.status === 'locked') {
      res.status(429).json({ message: 'Too many failed attempts. This OTP challenge is now locked. Please request a new OTP.' });
      return;
    }

    const remaining = Math.max(0, 5 - updatedOtp.attempts);
    res.status(400).json({ message: `Invalid OTP. Please try again. (${remaining} attempts remaining)` });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Forgot Password - Send OTP
// @desc    Forgot Password - Send OTP
// @route   POST /api/users/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email: rawEmail } = req.body;
    const email = normalizeIdentifier(String(rawEmail || ''), true);
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({ message: 'User with this email does not exist.' });
      return;
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(otpCode, email);

    await Otp.findOneAndUpdate(
      { identifier: email, purpose: 'PASSWORD_RESET' },
      {
        $set: {
          otpHash,
          role: user.role || 'customer',
          status: 'active',
          attempts: 0,
          consumedAt: undefined,
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

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

    const otpRecord = await Otp.findOne({ identifier: email, purpose: 'PASSWORD_RESET' });

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

    // Expiry check (5 minutes = 300000ms)
    const ageMs = Date.now() - otpRecord.createdAt.getTime();
    if (ageMs > 300000) {
      await Otp.updateOne({ _id: otpRecord._id }, { $set: { status: 'consumed' } });
      res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
      return;
    }

    const expectedHash = otpRecord.otpHash || (otpRecord.otpCode ? hashOtp(otpRecord.otpCode, email) : '');
    const submittedHash = hashOtp(safeOtp, email);
    const expectedBuf = Buffer.from(expectedHash, 'utf8');
    const submittedBuf = Buffer.from(submittedHash, 'utf8');

    const isMatch =
      expectedBuf.length === submittedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, submittedBuf);

    if (!isMatch) {
      const updatedOtp = await Otp.findOneAndUpdate(
        { _id: otpRecord._id, status: 'active' },
        [
          { $set: { attempts: { $add: ['$attempts', 1] } } },
          {
            $set: {
              status: { $cond: [{ $gte: ['$attempts', 5] }, 'locked', 'active'] },
              lockedAt: { $cond: [{ $gte: ['$attempts', 5] }, new Date(), '$$REMOVE'] }
            }
          }
        ],
        { new: true }
      );

      if (!updatedOtp || updatedOtp.status === 'locked') {
        res.status(429).json({ message: 'Too many failed attempts. This OTP challenge is now locked. Please request a new OTP.' });
        return;
      }

      const remaining = Math.max(0, 5 - updatedOtp.attempts);
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

    const otpRecord = await Otp.findOne({ identifier: email, purpose: 'PASSWORD_RESET' });
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

    const ageMs = Date.now() - otpRecord.createdAt.getTime();
    if (ageMs > 300000) {
      await Otp.updateOne({ _id: otpRecord._id }, { $set: { status: 'consumed' } });
      res.status(400).json({ message: 'OTP has expired. Please start over.' });
      return;
    }

    const expectedHash = otpRecord.otpHash || (otpRecord.otpCode ? hashOtp(otpRecord.otpCode, email) : '');
    const submittedHash = hashOtp(safeOtp, email);
    const expectedBuf = Buffer.from(expectedHash, 'utf8');
    const submittedBuf = Buffer.from(submittedHash, 'utf8');

    const isMatch =
      expectedBuf.length === submittedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, submittedBuf);

    if (!isMatch) {
      const updatedOtp = await Otp.findOneAndUpdate(
        { _id: otpRecord._id, status: 'active' },
        [
          { $set: { attempts: { $add: ['$attempts', 1] } } },
          {
            $set: {
              status: { $cond: [{ $gte: ['$attempts', 5] }, 'locked', 'active'] },
              lockedAt: { $cond: [{ $gte: ['$attempts', 5] }, new Date(), '$$REMOVE'] }
            }
          }
        ],
        { new: true }
      );

      if (!updatedOtp || updatedOtp.status === 'locked') {
        res.status(429).json({ message: 'Too many failed attempts. This OTP challenge is now locked. Please request a new OTP.' });
        return;
      }

      const remaining = Math.max(0, 5 - updatedOtp.attempts);
      res.status(400).json({ message: `Invalid OTP code. (${remaining} attempts remaining)` });
      return;
    }

    // Atomic CAS claim
    const claimed = await Otp.findOneAndUpdate(
      { _id: otpRecord._id, status: 'active' },
      { $set: { status: 'consumed', consumedAt: new Date() } },
      { new: true }
    );

    if (!claimed) {
      res.status(400).json({ message: 'OTP already consumed.' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    res.status(200).json({ message: 'Password reset successful. You can now log in.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
