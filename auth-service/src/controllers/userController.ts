import { Request, Response } from 'express';
import { User, IUser } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { Otp } from '../models/Otp';
import { generateAccessToken, generateRefreshToken, getRefreshTokenMaxAgeMs } from '../utils/generateToken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import { AuthRequest } from '../middleware/authMiddleware';
import { OAuth2Client } from 'google-auth-library';

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:5006';

/**
 * Fire-and-forget: enqueues a provider welcome email without blocking the response.
 */
const enqueueProviderWelcomeEmail = (name: string, email: string): void => {
  if (!email) return;
  axios
    .post(
      `${NOTIFICATION_SERVICE_URL}/api/notifications/enqueue`,
      {
        type: 'provider_welcome',
        recipient: email,
        title: 'Welcome to BharatClap — Your Registration is Confirmed!',
        metadata: { providerName: name },
      },
      { timeout: 5000 }
    )
    .then(() => console.log(`[AUTH] Provider welcome email enqueued for ${email}`))
    .catch((err: any) =>
      console.warn(`[AUTH] Could not enqueue provider welcome email for ${email}:`, err?.message)
    );
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, password, role, profile_image, gender } = req.body;

    const queryList = [];
    if (email) queryList.push({ email });
    if (phone) queryList.push({ phone });

    if (queryList.length === 0) {
      res.status(400).json({ message: 'Must provide an email or phone number.' });
      return;
    }

    const userExists = await User.findOne({ $or: queryList });

    if (userExists) {
      res.status(400).json({ message: 'User with this email or phone already exists. Please log in instead.' });
      return;
    }

    let hashedPassword = undefined;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    const user = await User.create({
      name,
      email: email || undefined,
      phone: phone || undefined,
      password: hashedPassword,
      role: (role === 'provider' ? 'provider' : 'customer') as any,
      gender,
      profile_image: profile_image || '',
      isEmailVerified: !!email,
      isPhoneVerified: !!phone,
    });

    if (user) {
      const refreshToken = generateRefreshToken(user._id.toString(), user.role);
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const maxAgeMs = getRefreshTokenMaxAgeMs(user.role);
      
      await RefreshToken.create({
        user_id: user._id,
        token_hash: tokenHash,
        device_info: req.headers['user-agent'] || 'Unknown Device',
        ip_address: req.ip || 'Unknown IP',
        expires_at: new Date(Date.now() + maxAgeMs)
      });

      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: maxAgeMs
      });

      // If registering as a provider, send a welcome / onboarding email (non-blocking)
      if (user.role === 'provider' && user.email) {
        enqueueProviderWelcomeEmail(user.name, user.email);
      }

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        gender: user.gender,
        profile_image: user.profile_image,
        token: generateAccessToken(user._id.toString()),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const identifier = (email || '').toString().trim();

    if (!identifier || !password) {
      res.status(400).json({ message: 'Please provide email/phone/username and password' });
      return;
    }

    // Escape regex characters for exact case-insensitive match on email or name
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = {
      $or: [
        { email: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        { phone: identifier },
        { name: { $regex: new RegExp(`^${escaped}$`, 'i') } }
      ]
    };

    const user = await User.findOne(query) as IUser & { _id: string, password?: string };

    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      const refreshToken = generateRefreshToken(user._id.toString(), user.role);
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const maxAgeMs = getRefreshTokenMaxAgeMs(user.role);
      
      await RefreshToken.create({
        user_id: user._id,
        token_hash: tokenHash,
        device_info: req.headers['user-agent'] || 'Unknown Device',
        ip_address: req.ip || 'Unknown IP',
        expires_at: new Date(Date.now() + maxAgeMs)
      });

      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: maxAgeMs
      });

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        gender: user.gender,
        profile_image: user.profile_image,
        token: generateAccessToken(user._id.toString()),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user with Google
// @route   POST /api/users/google-login
// @access  Public
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({ message: 'No Google token provided' });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      res.status(400).json({ message: 'Invalid Google token' });
      return;
    }

    const { email, name, picture, sub: googleId } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      // Create user
      user = await User.create({
        email,
        name: name || '',
        profile_image: picture || '',
        googleId,
        authProvider: 'google',
        role: 'customer',
        isEmailVerified: true,
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = 'google';
      await user.save();
    }

    // Generate tokens
    const refreshToken = generateRefreshToken(user._id.toString());
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    await RefreshToken.create({
      user_id: user._id,
      token_hash: tokenHash,
      device_info: req.headers['user-agent'] || 'Unknown Device',
      ip_address: req.ip || 'Unknown IP',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      gender: user.gender,
      profile_image: user.profile_image,
      token: generateAccessToken(user._id.toString()),
    });
  } catch (error: any) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
};

// @desc    Get current logged-in user profile
// @route   GET /api/users/me
// @access  Private
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update current logged-in user profile
// @route   PUT /api/users/me
// @access  Private
export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id) as IUser & { _id: string; password?: string };
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.name = req.body.name ?? user.name;
    user.email = req.body.email ?? user.email;
    user.phone = req.body.phone ?? user.phone;
    user.profile_image = req.body.profile_image ?? user.profile_image;
    user.gender = req.body.gender ?? user.gender;

    if (req.body.password) {
      const { otp } = req.body;
      if (!otp) {
        res.status(400).json({ message: 'OTP is required to change password. Please verify your email first.' });
        return;
      }

      const otpRecord = await Otp.findOne({ identifier: user.email, otpCode: otp });
      if (!otpRecord) {
        res.status(400).json({ message: 'Invalid or expired OTP.' });
        return;
      }

      await Otp.deleteOne({ _id: otpRecord._id });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updated = await user.save();

    res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      gender: updated.gender,
      role: updated.role,
      profile_image: updated.profile_image,
      status: updated.status,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const users = await User.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-password -tokenVersion')
      .lean();
      
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user count stats (Internal API)
// @route   GET /api/users/stats
// @access  Public (Internal)
export const getUserStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await User.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    let totalCustomers = 0, totalProviders = 0, totalAdmins = 0;
    for (const stat of stats) {
      if (stat._id === 'customer') totalCustomers = stat.count;
      else if (stat._id === 'provider') totalProviders = stat.count;
      else if (stat._id === 'admin') totalAdmins = stat.count;
    }

    res.json({ totalCustomers, totalProviders, totalAdmins });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get multiple users by IDs (Internal API)
// @route   POST /api/users/batch
// @access  Public (Internal)
export const getUsersBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({ message: 'Please provide an array of ids' });
      return;
    }
    const users = await User.find({ _id: { $in: ids } }).select('name email phone profile_image').lean();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update any user (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id) as IUser & { _id: string; password?: string };
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.name = req.body.name ?? user.name;
    user.email = req.body.email ?? user.email;
    user.phone = req.body.phone ?? user.phone;
    user.profile_image = req.body.profile_image ?? user.profile_image;

    if (req.body.status) {
      user.status = req.body.status.toLowerCase();
    }

    if (req.body.role) {
      const VALID_ROLES = ['admin', 'customer', 'provider'] as const;
      if (!VALID_ROLES.includes(req.body.role.toLowerCase())) {
        res.status(400).json({ message: 'Invalid role. Must be admin, customer, or provider.' });
        return;
      }
      user.role = req.body.role.toLowerCase() as typeof VALID_ROLES[number];
    }

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updated = await user.save();

    res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      gender: updated.gender,
      profile_image: updated.profile_image,
      status: updated.status,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a user (Soft Delete)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    user.isDeleted = true;
    user.status = 'blocked';
    await user.save();
    res.json({ message: 'User moved to trash (Soft Delete)' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

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

    if (mode === 'update' && !existingUser) {
      res.status(404).json({ message: 'User not found for update.' });
      return;
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();

    await Otp.findOneAndUpdate(
      { identifier },
      { otpCode, role: role || 'customer', identifier },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (useEmail) {
      const mailOptions = {
        from: process.env.SMTP_EMAIL || 'admin@serviceapp.com',
        to: identifier,
        subject: 'ServiceApp Verification OTP',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #1D2B83; text-align: center;">ServiceApp Verification</h2>
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
          await transporter.sendMail(mailOptions);
          console.log(`[SUCCESS] Email OTP sent to ${identifier}`);
        } else {
          console.log(`[MOCK EMAIL] Setup SMTP_EMAIL && SMTP_PASSWORD in .env to send real email. OTP for ${identifier}: ${otpCode}`);
        }
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }
    } else {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        try {
          const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          const formattedPhone = identifier.startsWith('+') ? identifier : `+91${identifier}`;

          await twilioClient.messages.create({
            body: `Your ServiceApp Verification OTP is: ${otpCode}. Please do not share this code with anyone.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedPhone
          });
          console.log(`[SUCCESS] SMS OTP sent to ${formattedPhone}`);
        } catch (smsError) {
          console.error('Failed to send SMS via Twilio:', smsError);
        }
      } else {
        console.log(`[MOCK SMS] Setup TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to send real SMS. OTP for phone ${identifier}: ${otpCode}`);
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

    const otpRecord = await Otp.findOne({ identifier });

    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP.' });
      return;
    }

    const MAX_ATTEMPTS = 5;
    if (otpRecord.otpCode !== otp) {
      otpRecord.attempts += 1;
      if (otpRecord.attempts >= MAX_ATTEMPTS) {
        await Otp.deleteOne({ _id: otpRecord._id });
        res.status(400).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
      } else {
        await otpRecord.save();
        res.status(400).json({ message: `Invalid OTP. ${MAX_ATTEMPTS - otpRecord.attempts} attempt(s) remaining.` });
      }
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

      const refreshToken = generateRefreshToken(existingUser._id.toString());
      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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
          token: generateAccessToken(existingUser._id.toString()),
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

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_EMAIL || 'admin@serviceapp.com',
      to: email,
      subject: 'Reset Your Password - ServiceApp',
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
      await transporter.sendMail(mailOptions);
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
    const otpRecord = await Otp.findOne({ identifier: email });

    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP.' });
      return;
    }

    const MAX_ATTEMPTS = 5;
    if (otpRecord.otpCode !== otp) {
      otpRecord.attempts += 1;
      if (otpRecord.attempts >= MAX_ATTEMPTS) {
        await Otp.deleteOne({ _id: otpRecord._id });
        res.status(400).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
      } else {
        await otpRecord.save();
        res.status(400).json({ message: `Invalid OTP. ${MAX_ATTEMPTS - otpRecord.attempts} attempt(s) remaining.` });
      }
      return;
    }

    // Keep the OTP for step 3 (resetPassword) to verify again
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

    const otpRecord = await Otp.findOne({ identifier: email });
    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP. Please start over.' });
      return;
    }

    const MAX_ATTEMPTS = 5;
    if (otpRecord.otpCode !== otp) {
      otpRecord.attempts += 1;
      if (otpRecord.attempts >= MAX_ATTEMPTS) {
        await Otp.deleteOne({ _id: otpRecord._id });
        res.status(400).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
      } else {
        await otpRecord.save();
        res.status(400).json({ message: `Invalid OTP. ${MAX_ATTEMPTS - otpRecord.attempts} attempt(s) remaining.` });
      }
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

// @desc    Refresh Token
// @route   POST /api/users/refresh
// @access  Public
export const refreshUserToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.jwt;

    if (!refreshToken) {
      res.status(401).json({ message: 'Not authorized, no refresh token' });
      return;
    }

    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
    }

    jwt.verify(refreshToken, secret, async (err: any, decoded: any) => {
      if (err) {
        res.status(403).json({ message: 'Refresh token is invalid or expired' });
        return;
      }

      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const tokenRecord = await RefreshToken.findOne({ token_hash: tokenHash });

      if (!tokenRecord || tokenRecord.revoked) {
        res.status(403).json({ message: 'Refresh token has been revoked or does not exist' });
        return;
      }

      const user = await User.findById(decoded.id);
      if (!user || user.isDeleted || user.status === 'blocked') {
        res.status(401).json({ message: 'User is no longer active' });
        return;
      }

      // Rotate token: Delete old, create new
      await RefreshToken.deleteOne({ _id: tokenRecord._id });

      const newRefreshToken = generateRefreshToken(user._id.toString(), user.role);
      const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
      const maxAgeMs = getRefreshTokenMaxAgeMs(user.role);

      await RefreshToken.create({
        user_id: user._id,
        token_hash: newTokenHash,
        device_info: tokenRecord.device_info,
        ip_address: req.ip || tokenRecord.ip_address,
        expires_at: new Date(Date.now() + maxAgeMs)
      });

      res.cookie('jwt', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: maxAgeMs
      });

      const accessToken = generateAccessToken(user._id.toString());
      res.json({ token: accessToken });
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout User / clear cookie & revoke refresh token in database
// @route   POST /api/users/logout
// @access  Public
export const logoutUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.jwt || req.cookies?.refreshToken || req.body?.refreshToken || req.headers['x-refresh-token'];
    let userId = null;

    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const session = await RefreshToken.findOne({ token_hash: tokenHash });
      if (session) {
        userId = session.user_id;
        await RefreshToken.deleteOne({ _id: session._id });
      }
    }

    // Record Logout Audit Event
    console.log('[LOGOUT_AUDIT]', JSON.stringify({
      userId: userId || 'unknown',
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
    }));

    // Purge HttpOnly & Auth Cookies
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      expires: new Date(0),
    };

    res.cookie('jwt', '', cookieOptions);
    res.cookie('token', '', { ...cookieOptions, httpOnly: false });
    res.cookie('userRole', '', { ...cookieOptions, httpOnly: false });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get active sessions for user
// @route   GET /api/users/sessions
// @access  Private
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await RefreshToken.find({ user_id: req.user?._id, revoked: false })
      .select('device_info ip_address createdAt expires_at token_hash')
      .sort({ createdAt: -1 })
      .lean();

    // Identify current session
    const currentToken = req.cookies?.jwt;
    let currentHash = '';
    if (currentToken) {
      currentHash = crypto.createHash('sha256').update(currentToken).digest('hex');
    }

    const mappedSessions = sessions.map((s: any) => {
      const isCurrent = currentHash === s.token_hash;
      return {
        _id: s._id,
        device_info: s.device_info,
        ip_address: s.ip_address,
        createdAt: s.createdAt,
        expires_at: s.expires_at,
        is_current: isCurrent
      };
    });

    res.json(mappedSessions);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout specific device
// @route   DELETE /api/users/sessions/:sessionId
// @access  Private
export const logoutDevice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await RefreshToken.findOne({ _id: req.params.sessionId, user_id: req.user?._id });
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    await RefreshToken.deleteOne({ _id: session._id });
    res.json({ message: 'Device logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout all devices
// @route   DELETE /api/users/sessions
// @access  Private
export const logoutAllDevices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await RefreshToken.deleteMany({ user_id: req.user?._id });
    
    // Increment tokenVersion to invalidate access tokens globally
    await User.findByIdAndUpdate(req.user?._id, { $inc: { tokenVersion: 1 } });

    res.cookie('jwt', '', {
      httpOnly: true,
      expires: new Date(0)
    });
    res.json({ message: 'Successfully logged out of all devices' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
