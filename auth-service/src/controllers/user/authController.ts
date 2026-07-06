import { Request, Response } from 'express';
import { User, IUser } from '../../models/User';
import { RefreshToken } from '../../models/RefreshToken';
import { generateAccessToken, generateRefreshToken } from '../../utils/generateToken';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

      // Reject suspended or soft-deleted accounts before issuing tokens
      if (user.isDeleted || user.status === 'blocked') {
        res.status(403).json({ message: 'Account is suspended or has been deleted. Please contact support.' });
        return;
      }

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
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
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

      const newRefreshToken = generateRefreshToken(user._id.toString());
      const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

      await RefreshToken.create({
        user_id: user._id,
        token_hash: newTokenHash,
        device_info: tokenRecord.device_info,
        ip_address: req.ip || tokenRecord.ip_address,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      res.cookie('jwt', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      const accessToken = generateAccessToken(user._id.toString());
      res.json({ token: accessToken });
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout User / clear cookie
// @route   POST /api/users/logout
// @access  Public
export const logoutUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.jwt;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await RefreshToken.deleteOne({ token_hash: tokenHash });
    }

    res.cookie('jwt', '', {
      httpOnly: true,
      expires: new Date(0)
    });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
