import { Request, Response } from 'express';
import { User, IUser } from '../../models/User';
import { RefreshToken } from '../../models/RefreshToken';
import { generateAccessToken, generateRefreshToken, getRefreshTokenMaxAgeMs } from '../../utils/generateToken';
import { enforceSessionLimit, getIdleTimeoutMs, handleTokenReuseSecurityBreach } from '../../utils/sessionHelper';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

import { CustomerReferral } from '../../models/CustomerReferral';

const generateReferralCode = async (name: string): Promise<string> => {
  const cleanName = (name || 'USER').replace(/[^a-zA-Z]/g, '').substring(0, 5).toUpperCase();
  let code = '';
  let isUnique = false;
  while (!isUnique) {
    const rand = Math.floor(100 + Math.random() * 900); // 3 digit random number
    code = `${cleanName}${rand}`;
    const existing = await User.findOne({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, password, role, profile_image, gender, referralCode, deviceFingerprint } = req.body;

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

    // Referral Validation BEFORE registration
    let referrer: any = null;
    if (referralCode && role !== 'provider') {
      referrer = await User.findOne({ referralCode: referralCode.toUpperCase(), role: 'customer' });
      if (!referrer) {
        res.status(400).json({ message: 'Invalid referral code.' });
        return;
      }
      if (email && referrer.email === email) {
        res.status(400).json({ message: 'You cannot refer yourself.' });
        return;
      }
      if (phone && referrer.phone === phone) {
        res.status(400).json({ message: 'You cannot refer yourself.' });
        return;
      }
    }

    let hashedPassword = undefined;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    // Generate unique referral code for this user
    const myReferralCode = await generateReferralCode(name || 'USER');

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
      referralCode: myReferralCode
    });

    if (user && referrer) {
      // Create CustomerReferral record
      await CustomerReferral.create({
        referrerId: referrer._id,
        refereeId: user._id,
        referralCodeUsed: referralCode.toUpperCase(),
        refereePhone: user.phone || 'Unknown Phone',
        referrerPhone: referrer.phone || 'Unknown Phone',
        ipAddress: req.ip || 'Unknown IP',
        deviceFingerprint: deviceFingerprint || 'Unknown FP'
      });
    }

    if (user) {
      await enforceSessionLimit(user._id.toString(), user.role);

      const refreshToken = generateRefreshToken(user._id.toString(), user.role);
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const maxAgeMs = getRefreshTokenMaxAgeMs(user.role);
      
      await RefreshToken.findOneAndUpdate(
        { token_hash: tokenHash },
        {
          $set: {
            user_id: user._id,
            token_hash: tokenHash,
            device_info: req.headers['user-agent'] || 'Unknown Device',
            ip_address: req.ip || 'Unknown IP',
            expires_at: new Date(Date.now() + maxAgeMs),
            revoked: false,
          },
        },
        { upsert: true, new: true }
      );

      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: maxAgeMs
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

      await enforceSessionLimit(user._id.toString(), user.role);

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

      const uRole = user.role as string;
      const effectiveAdminRole = user.admin_role || (uRole === 'admin' || uRole === 'super_admin' ? 'super_admin' : undefined);

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        admin_role: effectiveAdminRole,
        gender: user.gender,
        profile_image: user.profile_image,
        token: generateAccessToken(user._id.toString()),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error: any) {
    console.error('[AUTH] Login error:', error?.message || error);
    const isDbError = error?.name === 'MongooseError' || error?.name === 'MongoNetworkError' || error?.message?.includes('buffering') || error?.message?.includes('ENOTFOUND');
    const message = isDbError ? 'Database service is temporarily unreachable. Please verify network connection.' : (error?.message || 'Internal Server Error');
    res.status(500).json({ message });
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
        // Reuse Detection: If a valid JWT is presented but token_hash is revoked or missing, trigger security breach revocation
        await handleTokenReuseSecurityBreach(decoded.id);
        res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
        res.status(403).json({ message: 'Security Alert: Refresh token reuse detected. All sessions revoked.' });
        return;
      }

      const user = await User.findById(decoded.id);
      if (!user || user.isDeleted || user.status === 'blocked') {
        res.status(401).json({ message: 'User is no longer active' });
        return;
      }

      // Check Idle Timeout
      const idleTimeoutMs = getIdleTimeoutMs(user.role);
      const lastActive = new Date((tokenRecord as any).updatedAt || (tokenRecord as any).createdAt).getTime();
      if (Date.now() - lastActive > idleTimeoutMs) {
        await RefreshToken.deleteOne({ _id: tokenRecord._id });
        res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
        res.status(401).json({ message: 'Session expired due to inactivity. Please log in again.' });
        return;
      }

      // Rotate token: Delete old, create new (enforcing max device limit)
      await RefreshToken.deleteOne({ _id: tokenRecord._id });
      await enforceSessionLimit(user._id.toString(), user.role);

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

    const refreshToken = generateRefreshToken(user._id.toString(), user.role);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const maxAgeMs = getRefreshTokenMaxAgeMs(user.role);

    await RefreshToken.create({
      user_id: user._id,
      token_hash: tokenHash,
      device_info: req.headers['user-agent'] || 'Unknown Device',
      ip_address: req.ip || 'Unknown IP',
      expires_at: new Date(Date.now() + maxAgeMs),
    });

    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: maxAgeMs,
    });

    const uRoleG = user.role as string;
    const effectiveAdminRoleG = user.admin_role || (uRoleG === 'admin' || uRoleG === 'super_admin' ? 'super_admin' : undefined);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      admin_role: effectiveAdminRoleG,
      gender: user.gender,
      profile_image: user.profile_image,
      token: generateAccessToken(user._id.toString()),
    });
  } catch (error: any) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
};
