import { Request, Response } from 'express';
import { User, IUser } from '../models/User';
import { Otp } from '../models/Otp';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { AuthRequest } from '../middleware/authMiddleware';

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
      role: (role || 'customer').toLowerCase() as any,
      gender,
      profile_image: profile_image || '',
      isEmailVerified: !!email,
      isPhoneVerified: !!phone,
    });

    if (user) {
      const refreshToken = generateRefreshToken(user._id.toString());
      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

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

    const user = await User.findOne({ email }) as IUser & { _id: string, password?: string };

    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      const refreshToken = generateRefreshToken(user._id.toString());
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
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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

// @desc    Get all users (Public/Admin)
// @route   GET /api/users
// @access  Public
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({ isDeleted: false }).sort({ createdAt: -1 });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Public/Internal
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
    const totalCustomers = await User.countDocuments({ role: 'customer', isDeleted: false });
    const totalProviders = await User.countDocuments({ role: 'provider', isDeleted: false });
    const totalAdmins = await User.countDocuments({ role: 'admin', isDeleted: false });
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
      user.role = req.body.role.toLowerCase() as any;
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

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { identifier },
      { otpCode, role: role || 'customer', identifier },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (useEmail) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      });

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

    res.status(200).json({ message: 'OTP sent successfully', otpCode });
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

    const otpRecord = await Otp.findOne({ identifier, otpCode: otp });

    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP.' });
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

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
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
    const otpRecord = await Otp.findOne({ identifier: email, otpCode: otp });

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

    const otpRecord = await Otp.findOne({ identifier: email, otpCode: otp });
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

    const secret = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key_123';
    import('jsonwebtoken').then(jwt => {
      jwt.verify(refreshToken, secret, async (err: any, decoded: any) => {
        if (err) {
          res.status(403).json({ message: 'Refresh token is invalid or expired' });
          return;
        }

        const user = await User.findById(decoded.id);
        if (!user) {
          res.status(401).json({ message: 'User no longer exists' });
          return;
        }

        const accessToken = generateAccessToken(user._id.toString());
        res.json({ token: accessToken });
      });
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout User / clear cookie
// @route   POST /api/users/logout
// @access  Public
export const logoutUser = async (req: Request, res: Response): Promise<void> => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0)
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

