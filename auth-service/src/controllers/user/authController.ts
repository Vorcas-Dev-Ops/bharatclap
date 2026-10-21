import { Request, Response } from 'express';
import { UserRepository, UserEntity } from '../../repositories/userRepository';
import { AdminRepository } from '../../repositories/adminRepository';
import { RefreshTokenRepository } from '../../repositories/refreshTokenRepository';
import { ReferralRepository } from '../../repositories/referralRepository';
import { generateAccessToken, generateRefreshToken, getRefreshTokenMaxAgeMs } from '../../utils/generateToken';
import { enforceSessionLimit, getIdleTimeoutMs, handleTokenReuseSecurityBreach } from '../../utils/sessionHelper';
import { getDb } from '../../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { normalizeIdentifier } from './verificationController';
import { issueSession, sessionResponse } from '../../services/sessionService';
import { setAuthCookies, setAccessCookie, clearAuthCookies, clientOf, bodyToken } from '../../utils/authCookies';
import { readAccessToken } from '@bharatclap/shared';
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
    const { name, email, phone, password, role, profile_image, gender, date_of_birth, referralCode, deviceFingerprint, verificationToken } = req.body;

    if (!email && !phone) {
      res.status(400).json({ message: 'Must provide an email or phone number.' });
      return;
    }

    if (phone) {
      const norm = normalizeIdentifier(phone, false);
      if (!norm) {
        res.status(400).json({ message: 'Invalid mobile number. Please provide a valid 10-digit Indian mobile number.' });
        return;
      }
    }

    const userExists = await UserRepository.findByEmailOrPhone(email, phone);

    if (userExists) {
      if (phone) {
        res.status(400).json({ message: 'This mobile number is already registered.' });
        return;
      }
      res.status(400).json({ message: 'This email is already registered.' });
      return;
    }

    // Server-Authoritative Role Assignment
    // The frontend cannot simply send { "role": "provider" } and have the backend trust it.
    // Provider accounts require a valid cryptographic registration_proof token issued during OTP verification,
    // or an authorized internal-service header.
    let assignedRole: 'customer' | 'provider' = 'customer';
    if (role === 'provider') {
      const internalKey = req.headers['x-internal-service-key'];
      const expectedInternalKey = process.env.INTERNAL_SERVICE_KEY;
      const isInternal = Boolean(
        expectedInternalKey &&
        internalKey &&
        typeof internalKey === 'string' &&
        Buffer.from(internalKey).length === Buffer.from(expectedInternalKey).length &&
        crypto.timingSafeEqual(Buffer.from(internalKey), Buffer.from(expectedInternalKey))
      );

      if (!isInternal) {
        if (!verificationToken) {
          res.status(403).json({
            message: 'Server-authoritative check failed: Provider registration requires a verified OTP verification token.',
          });
          return;
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          res.status(500).json({ message: 'Server configuration error: JWT_SECRET not configured' });
          return;
        }

        try {
          const decoded = jwt.verify(verificationToken, jwtSecret) as any;
          const normalizedTargetPhone = phone ? normalizeIdentifier(phone, false) : '';
          const normalizedTargetEmail = email ? normalizeIdentifier(email, true) : '';

          if (
            decoded.type !== 'registration_proof' ||
            decoded.role !== 'provider' ||
            (decoded.identifier !== normalizedTargetPhone && decoded.identifier !== normalizedTargetEmail)
          ) {
            res.status(403).json({
              message: 'Invalid or mismatched provider registration verification token.',
            });
            return;
          }
        } catch (err: any) {
          res.status(403).json({
            message: 'Expired or invalid provider verification token. Please verify OTP again.',
          });
          return;
        }
      }
      assignedRole = 'provider';
    }

    // Referral Validation BEFORE registration
    let referrer: UserEntity | null = null;
    if (referralCode && assignedRole !== 'provider') {
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
      role: assignedRole,
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
      const tokenBody = await issueSession(req, res, user);
      res.status(201).json(sessionResponse(user, tokenBody));
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error: any) {
    if (error.code === '23505' && (String(error.detail || error.message).includes('normalized_phone') || String(error.detail || error.message).includes('ux_users_phone'))) {
      res.status(400).json({ message: 'This mobile number is already registered.' });
      return;
    }
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

      // Server-side portal check. Only the provider page sends portal: 'provider'.
      if (req.body?.portal === 'provider' && user.role !== 'provider') {
        res.status(403).json({ message: 'This account is not a provider account.' });
        return;
      }

      await UserRepository.recordLogin(user.id);
      const tokenBody = await issueSession(req, res, user);
      res.json(sessionResponse(user, tokenBody));
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
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const admin = await AdminRepository.findByEmail(email);

    if (admin && admin.password_hash && (await bcrypt.compare(password, admin.password_hash))) {
      if (admin.deleted_at || admin.status === 'blocked') {
        res.status(403).json({ message: 'Account is suspended or has been deleted. Please contact support.' });
        return;
      }

      // Check lockout
      if (admin.otp_locked_until && new Date(admin.otp_locked_until) > new Date()) {
        const remainingMs = new Date(admin.otp_locked_until).getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        res.status(403).json({ message: `Account locked. Try again in ${remainingMin} minute(s).` });
        return;
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        res.status(500).json({ message: 'Server misconfigured' });
        return;
      }

      // If 2FA is enabled on this account, require TOTP verification
      if (admin.totp_secret) {
        const tempToken = jwt.sign(
          { id: admin.id, purpose: 'two_factor_verify' },
          secret,
          { expiresIn: '5m' }
        );
        res.json({
          requiresTwoFactor: true,
          tempToken,
          message: 'Two-factor authentication code required',
        });
        return;
      }

      // If 2FA is NOT configured on this account:
      // Require setup only if explicitly enforced via ADMIN_ENFORCE_2FA='true'
      if (process.env.ADMIN_ENFORCE_2FA === 'true') {
        const tempToken = jwt.sign(
          { id: admin.id, purpose: 'two_factor_setup' },
          secret,
          { expiresIn: '10m' }
        );
        res.json({
          requiresTwoFactorSetup: true,
          tempToken,
          message: 'Two-factor authentication setup required',
        });
        return;
      }

      // Otherwise (2FA not configured and not strictly enforced): complete login directly
      const tokenBody = await issueSession(req, res, { ...admin, role: 'admin' }, { subject_type: 'admin' });
      const effectiveAdminRole = admin.admin_role || 'super_admin';
      const token = tokenBody.token || tokenBody.accessToken;
      res.json({
        _id: admin.id,
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: 'admin',
        admin_role: effectiveAdminRole,
        permissions: admin.permissions || [],
        token,
        accessToken: token,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          role: 'admin',
          admin_role: effectiveAdminRole,
          permissions: admin.permissions || [],
          token,
          accessToken: token,
          ...tokenBody,
        },
        ...tokenBody,
      });
      return;
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

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, secret);
    } catch (err: any) {
      res.status(403).json({ message: 'Refresh token is invalid or expired' });
      return;
    }

    const pool = getDb();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const tokenRes = await client.query(
          `SELECT * FROM auth.refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
          [tokenHash]
        );
        const tokenRecord = tokenRes.rows[0];

        if (!tokenRecord) {
          await client.query('ROLLBACK');
          res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
          res.status(403).json({ message: 'Invalid refresh token.' });
          return;
        }
        // Before the grace-window branch: resolve the session owner from the stored row
        const isAdminSession = tokenRecord.admin_id != null;
        const subjectId: string = isAdminSession ? tokenRecord.admin_id : decoded.id;

        const loadSubject = () =>
          isAdminSession ? AdminRepository.findById(subjectId) : UserRepository.findById(subjectId);
        const subjectRole = isAdminSession ? 'admin' : undefined; // set from the loaded user below
        let extraClaims = isAdminSession ? { subject_type: 'admin' } : undefined;

        // Case 1: Token was already rotated or revoked
        if (tokenRecord.revoked) {
          // If revoked because of session limit eviction, do NOT treat as security breach
          if (tokenRecord.revoked_reason === 'SESSION_LIMIT') {
            await client.query('ROLLBACK');
            clearAuthCookies(res);
            res.status(401).json({ message: 'Session expired due to login on another device' });
            return;
          }

          const GRACE_WINDOW_MS = 30 * 1000; // 30-second concurrency grace window
          const rotatedAtMs = tokenRecord.rotated_at ? new Date(tokenRecord.rotated_at).getTime() : 0;
          const isWithinGraceWindow = rotatedAtMs > 0 && (Date.now() - rotatedAtMs) < GRACE_WINDOW_MS;

          if (isWithinGraceWindow && tokenRecord.replaced_by_hash) {
            // Check device match: reject if request device does not match the session's device
            const currentDevice = (req.headers['user-agent'] as string) || 'Unknown Device';
            if (tokenRecord.device_info && tokenRecord.device_info !== currentDevice) {
              await client.query('ROLLBACK');
              clearAuthCookies(res);
              res.status(403).json({ message: 'Security Alert: Device mismatch during concurrent token refresh.' });
              return;
            }

            // Check active replacement session
            const replRes = await client.query(
              `SELECT * FROM auth.refresh_tokens WHERE token_hash = $1 AND revoked = FALSE LIMIT 1`,
              [tokenRecord.replaced_by_hash]
            );
            const replSession = replRes.rows[0];

            if (replSession) {
              await client.query('COMMIT');
              console.log(`[REFRESH CONCURRENCY] Handled concurrent refresh for subject ${subjectId} within grace window.`);

              const subject = await loadSubject();
              if (!subject || subject.status === 'blocked' || (!isAdminSession && (subject as any).isDeleted)) {
                clearAuthCookies(res);
                res.status(401).json({ message: 'User is no longer active' });
                return;
              }

              const role = isAdminSession ? 'admin' : (subject as any).role;
              const tokenVersion = (subject as any).token_version ?? (subject as any).tokenVersion ?? 0;
              const clientType = clientOf(req);
              const graceClaims = (isAdminSession || role === 'admin') ? { subject_type: 'admin' } : undefined;
              const accessToken = generateAccessToken(subjectId, role, tokenVersion, clientType, graceClaims);

              setAccessCookie(res, accessToken);
              res.json({ success: true, token: accessToken, accessToken, ...bodyToken(clientType, accessToken) });
              return;
            }
          }

          // Outside grace window OR genuine reuse attempt: TRIGGER SECURITY BREACH
          await client.query('COMMIT');
          await handleTokenReuseSecurityBreach(isAdminSession ? { adminId: subjectId } : { userId: subjectId });
          clearAuthCookies(res);
          res.status(403).json({ message: 'Security Alert: Refresh token reuse detected. All sessions revoked.' });
          return;
        }

        // Case 2: Token is not revoked (First request in rotation)
        const subject = await loadSubject();
        if (!subject || subject.status === 'blocked' || (!isAdminSession && (subject as any).isDeleted)) {
          await client.query('ROLLBACK');
          clearAuthCookies(res);
          res.status(401).json({ message: 'User is no longer active' });
          return;
        }

        const role = isAdminSession ? 'admin' : (subject as any).role;
        const clientType = clientOf(req);
        const tokenVersion = (subject as any).token_version ?? (subject as any).tokenVersion ?? 0;
        extraClaims = (isAdminSession || role === 'admin') ? { subject_type: 'admin' } : undefined;

        // Idle timeout and max age use the role
        const idleTimeoutMs = getIdleTimeoutMs(role);
        const lastActive = new Date(tokenRecord.updated_at || tokenRecord.created_at).getTime();
        if (Date.now() - lastActive > idleTimeoutMs) {
          await client.query(`UPDATE auth.refresh_tokens SET revoked = TRUE, updated_at = NOW() WHERE id = $1`, [tokenRecord.id]);
          await client.query('COMMIT');
          clearAuthCookies(res);
          res.status(401).json({ message: 'Session expired due to inactivity. Please log in again.' });
          return;
        }

        const newRefreshToken = generateRefreshToken(subjectId, role, tokenVersion, extraClaims);
        const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
        const maxAgeMs = getRefreshTokenMaxAgeMs(role);
        const accessToken = generateAccessToken(subjectId, role, tokenVersion, clientType, extraClaims);

        // Mark old token as rotated with reference to replacement
        await client.query(
          `UPDATE auth.refresh_tokens
           SET revoked = TRUE,
               rotated_at = NOW(),
               replaced_by_hash = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [newTokenHash, tokenRecord.id]
        );

        // Save new replacement token - writes owner column the session already has
        if ('admin_id' in tokenRecord) {
          await client.query(
            `INSERT INTO auth.refresh_tokens (user_id, admin_id, token_hash, device_info, ip_address, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              isAdminSession ? null : subjectId,
              isAdminSession ? subjectId : null,
              newTokenHash,
              tokenRecord.device_info,
              req.ip || tokenRecord.ip_address,
              new Date(Date.now() + maxAgeMs),
            ]
          );
        } else {
          await client.query(
            `INSERT INTO auth.refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              subjectId,
              newTokenHash,
              tokenRecord.device_info,
              req.ip || tokenRecord.ip_address,
              new Date(Date.now() + maxAgeMs),
            ]
          );
        }

        // Enforce session limit inside transaction before COMMIT using transaction client
        await enforceSessionLimit(isAdminSession ? { adminId: subjectId } : { userId: subjectId }, role, client);

        await client.query('COMMIT');

        setAuthCookies(res, accessToken, newRefreshToken, maxAgeMs);
        res.json({ success: true, token: accessToken, accessToken, ...bodyToken(clientType, accessToken) });
      } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
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
    let userId: string | null = null;

    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const session = await RefreshTokenRepository.findByTokenHash(tokenHash);
      if (session) {
        userId = String(session.user_id);
        await RefreshTokenRepository.revokeToken(tokenHash);
      }
    }

    const accessToken = readAccessToken(req);
    if (!userId && accessToken) {
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        try {
          const decoded: any = jwt.verify(accessToken, jwtSecret, { ignoreExpiration: true });
          if (decoded?.id || decoded?.userId) {
            userId = String(decoded.id || decoded.userId);
          }
        } catch {}
      }
    }

    if (userId) {
      await RefreshTokenRepository.revokeAllForUser(userId);
    }

    console.log('[LOGOUT_AUDIT]', JSON.stringify({
      userId: userId || 'unknown',
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
    }));

    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error: any) {
    clearAuthCookies(res);
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

    const effectiveAdminRoleG = user.admin_role || (user.role === 'admin' ? 'super_admin' : undefined);

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
