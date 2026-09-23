import { Request, Response } from 'express';
import { UserRepository, UserEntity } from '../../repositories/userRepository';
import { RefreshTokenRepository } from '../../repositories/refreshTokenRepository';
import { ReferralRepository } from '../../repositories/referralRepository';
import { generateAccessToken, generateRefreshToken, getRefreshTokenMaxAgeMs } from '../../utils/generateToken';
import { enforceSessionLimit, getIdleTimeoutMs, handleTokenReuseSecurityBreach } from '../../utils/sessionHelper';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateReferralCode = async (name: string): Promise<string> => {
  const cleanName = (name || 'USER').replace(/[^a-zA-Z]/g, '').substring(0, 5).toUpperCase();
  let code = '';
  let isUnique = false;
  while (!isUnique) {
    const rand = Math.floor(100 + Math.random() * 900); // 3 digit random number
    code = `${cleanName}${rand}`;
    const existing = await UserRepository.findByReferralCode(code);
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
    const { name, email, phone, password, role, profile_image, gender, date_of_birth, referralCode, deviceFingerprint } = req.body;

    if (!email && !phone) {
      res.status(400).json({ message: 'Must provide an email or phone number.' });
      return;
    }

    const userExists = await UserRepository.findByEmailOrPhone(email, phone);

    if (userExists) {
      res.status(400).json({ message: 'User with this email or phone already exists. Please log in instead.' });
      return;
    }

    // Referral Validation BEFORE registration
    let referrer: UserEntity | null = null;
    if (referralCode && role !== 'provider') {
      referrer = await UserRepository.findByReferralCode(referralCode.toUpperCase());
      if (!referrer || referrer.role !== 'customer') {
        res.status(400).json({ message: 'Invalid referral code.' });
        return;
      }
      if (email && referrer.email?.toLowerCase() === email.toLowerCase()) {
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

    const user = await UserRepository.create({
      name,
      email: email || undefined,
      phone: phone || undefined,
      password_hash: hashedPassword,
      role: role === 'provider' ? 'provider' : 'customer',
      gender,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : undefined,
      profile_image: profile_image || '',
      is_email_verified: Boolean(email),
      is_phone_verified: Boolean(phone),
      referral_code: myReferralCode,
    });

    if (user && referrer) {
      await ReferralRepository.createReferral({
        referrerId: referrer.id,
        referredId: user.id,
      });
    }

    if (user) {
      await enforceSessionLimit(user.id, user.role);

      const refreshToken = generateRefreshToken(user.id, user.role);
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const maxAgeMs = getRefreshTokenMaxAgeMs(user.role);

      await RefreshTokenRepository.saveToken({
        userId: user.id,
        tokenHash,
        deviceInfo: req.headers['user-agent'] as string || 'Unknown Device',
        ipAddress: req.ip || 'Unknown IP',
        expiresAt: new Date(Date.now() + maxAgeMs),
      });

      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: maxAgeMs,
      });

      res.status(201).json({
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        gender: user.gender,
        profile_image: user.profile_image,
        token: generateAccessToken(user.id, user.role),
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
// @access  Public (customers + providers only)
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await UserRepository.findByEmail(email);

    if (user && user.password_hash && (await bcrypt.compare(password, user.password_hash))) {
      // Reject suspended or soft-deleted accounts before issuing tokens
      if (user.isDeleted || user.status === 'blocked') {
        res.status(403).json({ message: 'Account is suspended or has been deleted. Please contact support.' });
        return;
      }

      // Reject admin accounts — they must use /admin/login
      if (user.role === 'admin') {
        res.status(403).json({ message: 'Admin accounts must use the admin login portal.' });
        return;
      }

      await enforceSessionLimit(user.id, user.role);
      await UserRepository.recordLogin(user.id);

      const refreshToken = generateRefreshToken(user.id, user.role);
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const maxAgeMs = getRefreshTokenMaxAgeMs(user.role);

      await RefreshTokenRepository.saveToken({
        userId: user.id,
        tokenHash,
        deviceInfo: req.headers['user-agent'] as string || 'Unknown Device',
        ipAddress: req.ip || 'Unknown IP',
        expiresAt: new Date(Date.now() + maxAgeMs),
      });

      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: maxAgeMs,
      });

      res.json({
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        gender: user.gender,
        profile_image: user.profile_image,
        token: generateAccessToken(user.id, user.role),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error: any) {
    console.error('[AUTH] Login error:', error?.message || error);
    res.status(500).json({ message: error?.message || 'Internal Server Error' });
  }
};

// @desc    Admin Login (with 2FA)
// @route   POST /api/users/admin/login
// @access  Public (admin accounts only)
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await UserRepository.findByEmail(email);

    if (user && user.password_hash && (await bcrypt.compare(password, user.password_hash))) {
      // Only admin accounts
      if (user.role !== 'admin') {
        res.status(403).json({ message: 'This login is for admin accounts only.' });
        return;
      }

      if (user.isDeleted || user.status === 'blocked') {
        res.status(403).json({ message: 'Account is suspended or has been deleted. Please contact support.' });
        return;
      }

      // Check lockout
      if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
        const remainingMs = user.otpLockedUntil.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        res.status(403).json({ message: `Account locked. Try again in ${remainingMin} minute(s).` });
        return;
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        res.status(500).json({ message: 'Server misconfigured' });
        return;
      }

      if (!user.twoFactorEnabled) {
        // First login — must set up 2FA
        const tempToken = jwt.sign(
          { id: user.id, purpose: 'two_factor_setup' },
          secret,
          { expiresIn: '10m' }
        );
        res.json({
          requiresTwoFactorSetup: true,
          tempToken,
          message: 'Two-factor authentication setup required. Use this token to set up 2FA.',
        });
        return;
      }

      // 2FA enabled — require TOTP verification
      const tempToken = jwt.sign(
        { id: user.id, purpose: 'two_factor_verify' },
        secret,
        { expiresIn: '5m' }
      );
      res.json({
        requiresTwoFactor: true,
        tempToken,
        message: 'Enter your authenticator code to complete login.',
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error: any) {
    console.error('[AUTH] Admin login error:', error?.message || error);
    res.status(500).json({ message: error?.message || 'Internal Server Error' });
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
      const tokenRecord = await RefreshTokenRepository.findByTokenHash(tokenHash);

      if (!tokenRecord || tokenRecord.revoked) {
        // Reuse Detection: trigger security breach revocation
        await handleTokenReuseSecurityBreach(decoded.id);
        res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
        res.status(403).json({ message: 'Security Alert: Refresh token reuse detected. All sessions revoked.' });
        return;
      }

      const user = await UserRepository.findById(decoded.id);
      if (!user || user.isDeleted || user.status === 'blocked') {
        res.status(401).json({ message: 'User is no longer active' });
        return;
      }

      // Check Idle Timeout
      const idleTimeoutMs = getIdleTimeoutMs(user.role);
      const lastActive = new Date(tokenRecord.updated_at || tokenRecord.created_at).getTime();
      if (Date.now() - lastActive > idleTimeoutMs) {
        await RefreshTokenRepository.revokeToken(tokenHash);
        res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
        res.status(401).json({ message: 'Session expired due to inactivity. Please log in again.' });
        return;
      }

      // Rotate token: revoke old, create new
      await RefreshTokenRepository.revokeToken(tokenHash);
      await enforceSessionLimit(user.id, user.role);

      const newRefreshToken = generateRefreshToken(user.id, user.role);
      const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
      const maxAgeMs = getRefreshTokenMaxAgeMs(user.role);

      await RefreshTokenRepository.saveToken({
        userId: user.id,
        tokenHash: newTokenHash,
        deviceInfo: tokenRecord.device_info,
        ipAddress: req.ip || tokenRecord.ip_address,
        expiresAt: new Date(Date.now() + maxAgeMs),
      });

      res.cookie('jwt', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: maxAgeMs,
      });

      const accessToken = generateAccessToken(user.id, user.role);
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
      const session = await RefreshTokenRepository.findByTokenHash(tokenHash);
      if (session) {
        userId = session.user_id;
        await RefreshTokenRepository.revokeToken(tokenHash);
      }
    }

    console.log('[LOGOUT_AUDIT]', JSON.stringify({
      userId: userId || 'unknown',
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
    }));

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

    let user = await UserRepository.findByEmail(email || '');

    if (!user) {
      user = await UserRepository.create({
        email,
        name: name || '',
        profile_image: picture || '',
        google_id: googleId,
        auth_provider: 'google',
        role: 'customer',
        is_email_verified: true,
      });
    } else if (!user.googleId) {
      user = await UserRepository.update(user.id, {
        google_id: googleId,
        auth_provider: 'google',
      });
    }

    if (!user) {
      res.status(500).json({ message: 'Could not create or update user profile' });
      return;
    }

    const refreshToken = generateRefreshToken(user.id, user.role);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const maxAgeMs = getRefreshTokenMaxAgeMs(user.role);

    await RefreshTokenRepository.saveToken({
      userId: user.id,
      tokenHash,
      deviceInfo: req.headers['user-agent'] as string || 'Unknown Device',
      ipAddress: req.ip || 'Unknown IP',
      expiresAt: new Date(Date.now() + maxAgeMs),
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
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      admin_role: effectiveAdminRoleG,
      gender: user.gender,
      profile_image: user.profile_image,
      token: generateAccessToken(user.id, user.role),
    });
  } catch (error: any) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
};
