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

// @desc    Send OTP for registration/login
// @route   POST /api/users/send-otp
// @access  Public
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, role, useEmail, mode } = req.body;

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


    const otpCode = crypto.randomInt(100000, 1000000).toString();

    await Otp.findOneAndUpdate(
      { identifier },
      { otpCode, role: role || 'customer', identifier },
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

          await axios.post(
            'https://control.msg91.com/api/v5/otp',
            { OTP: otpCode }, // passes OTP into the template variable {#var#}
            {
              params: {
                authkey: process.env.MSG91_AUTHKEY,
                template_id: process.env.MSG91_TEMPLATE_ID,
                mobile: formattedMobile,
              },
              headers: { 'Content-Type': 'application/json' },
            }
          );
          console.log(`[SUCCESS] SMS OTP sent via MSG91 to ${formattedMobile}`);
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
    const { identifier, otp, useEmail } = req.body;

    // ponytail: String() coercion blocks NoSQL injection operators ({ $gt: "" } etc.)
    const safeIdentifier = String(identifier || '');
    const safeOtp = String(otp || '');

    const otpRecord = await Otp.findOne({ identifier: safeIdentifier, otpCode: safeOtp });

    if (!otpRecord) {
      // Increment attempts on the identifier's OTP record even on mismatch
      await Otp.updateOne({ identifier: safeIdentifier }, { $inc: { attempts: 1 } });
      res.status(400).json({ message: 'Invalid or expired OTP.' });
      return;
    }

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });
      res.status(429).json({ message: 'Too many failed attempts. Please request a new OTP.' });
      return;
    }

    const existingUser = await User.findOne(useEmail ? { email: identifier } : { phone: identifier });

    await Otp.deleteOne({ _id: otpRecord._id });

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
          email: useEmail ? identifier : "",
          phone: !useEmail ? identifier : "",
          token: "pending_auth_token",
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/users/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({ message: 'User with this email does not exist.' });
      return;
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    await Otp.findOneAndUpdate(
      { identifier: email },
      { otpCode, identifier: email },
      { upsert: true }
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
    const { email, otp } = req.body;
    const otpRecord = await Otp.findOne({ identifier: String(email || ''), otpCode: String(otp || '') });

    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP.' });
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
    const { email, otp, password } = req.body;

    const otpRecord = await Otp.findOne({ identifier: String(email || ''), otpCode: String(otp || '') });
    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP. Please start over.' });
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

    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: 'Password reset successful. You can now log in.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
