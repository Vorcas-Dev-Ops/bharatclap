import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { User } from '../../models/User';
import { AdminActivityLog } from '../../models/AdminActivityLog';
import { generateAccessToken, generateRefreshToken, getRefreshTokenMaxAgeMs } from '../../utils/generateToken';
import { RefreshToken } from '../../models/RefreshToken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/** Generate 8 random recovery codes (10-char alphanumeric) */
function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(5).toString('hex').toUpperCase());
  }
  return codes;
}

interface TempTokenPayload { id: string; purpose: 'two_factor_setup' | 'two_factor_verify'; }

function verifyTempToken(token: string): TempTokenPayload | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    return jwt.verify(token, secret) as TempTokenPayload;
  } catch {
    return null;
  }
}

/**
 * POST /api/users/admin/2fa/setup
 * Generate TOTP secret + QR code for first-time 2FA setup.
 * Requires a short-lived tempToken from the login step.
 */
export const setup2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempToken } = req.body;
    const payload = verifyTempToken(tempToken);
    if (!payload || payload.purpose !== 'two_factor_setup') {
      res.status(401).json({ message: 'Invalid or expired setup token' });
      return;
    }

    const user = await User.findById(payload.id);
    if (!user || user.role !== 'admin') {
      res.status(404).json({ message: 'Admin not found' });
      return;
    }

    if (user.twoFactorEnabled) {
      res.status(400).json({ message: '2FA is already enabled' });
      return;
    }

    const appName = process.env.APP_NAME || 'BharatClap Admin';
    const secret = speakeasy.generateSecret({
      name: `${appName} (${user.email})`,
      issuer: appName,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Store base32 secret temporarily (not yet verified)
    user.twoFactorSecret = secret.base32;
    await user.save();

    res.json({
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
      message: 'Scan the QR code with Google Authenticator, then verify with a code.',
    });
  } catch (error: any) {
    console.error('[2FA] Setup error:', error.message);
    res.status(500).json({ message: 'Failed to set up 2FA' });
  }
};

/**
 * POST /api/users/admin/2fa/verify-setup
 * Verify the first TOTP code to confirm setup.
 */
export const verifySetup2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempToken, code } = req.body;
    const payload = verifyTempToken(tempToken);
    if (!payload || payload.purpose !== 'two_factor_setup') {
      res.status(401).json({ message: 'Invalid or expired setup token' });
      return;
    }

    const user = await User.findById(payload.id) as any;
    if (!user || user.role !== 'admin' || !user.twoFactorSecret) {
      res.status(400).json({ message: 'Setup not initiated' });
      return;
    }

    // ponytail: window=1 → accepts codes 30s before/after current
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      res.status(401).json({ message: 'Invalid code. Please try again.' });
      return;
    }

    // Generate recovery codes
    const plainCodes = generateRecoveryCodes();
    const hashedCodes = await Promise.all(plainCodes.map(c => bcrypt.hash(c, 10)));

    // Activate 2FA
    user.twoFactorEnabled = true;
    user.twoFactorRecoveryCodes = hashedCodes;
    user.failedOtpAttempts = 0;
    user.lastLogin = new Date();
    await user.save();

    await AdminActivityLog.create({
      admin_id: user._id,
      admin_name: user.name,
      action: 'ADMIN_2FA_ENABLED',
      target_id: user._id.toString(),
      details: { email: user.email, recoveryCodesGenerated: 8 },
    });

    // Issue full tokens — also return recovery codes (shown ONCE)
    await issueFullTokens(req, res, user, plainCodes);
  } catch (error: any) {
    console.error('[2FA] Verify setup error:', error.message);
    res.status(500).json({ message: 'Failed to verify 2FA setup' });
  }
};

/**
 * POST /api/users/admin/2fa/verify
 * Verify TOTP on login (2FA already enabled).
 */
export const verify2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempToken, code } = req.body;
    const payload = verifyTempToken(tempToken);
    if (!payload || payload.purpose !== 'two_factor_verify') {
      res.status(401).json({ message: 'Invalid or expired verification token' });
      return;
    }

    const user = await User.findById(payload.id) as any;
    if (!user || user.role !== 'admin') {
      res.status(404).json({ message: 'Admin not found' });
      return;
    }

    // Check lockout
    if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
      const remainingMs = user.otpLockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      res.status(403).json({ message: `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).` });
      return;
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      user.failedOtpAttempts = (user.failedOtpAttempts || 0) + 1;

      // Lock after 5 failed attempts for 15 minutes
      if (user.failedOtpAttempts >= 5) {
        user.otpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        await AdminActivityLog.create({
          admin_id: user._id,
          admin_name: user.name,
          action: 'ADMIN_2FA_LOCKED',
          target_id: user._id.toString(),
          details: { reason: '5 failed OTP attempts', lockedUntil: user.otpLockedUntil },
        });

        res.status(403).json({ message: 'Account locked for 15 minutes due to too many failed OTP attempts.' });
        return;
      }

      await user.save();
      res.status(401).json({
        message: 'Invalid code',
        attemptsRemaining: 5 - user.failedOtpAttempts,
      });
      return;
    }

    // Success — reset counters
    user.failedOtpAttempts = 0;
    user.otpLockedUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    await issueFullTokens(req, res, user);
  } catch (error: any) {
    console.error('[2FA] Verify error:', error.message);
    res.status(500).json({ message: 'Failed to verify 2FA' });
  }
};

/**
 * POST /api/users/admin/2fa/recover
 * Login using a one-time recovery code — bypasses TOTP and lockout.
 * Each code is single-use (removed from DB after use).
 */
export const recover2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempToken, recoveryCode } = req.body;
    const payload = verifyTempToken(tempToken);
    if (!payload || payload.purpose !== 'two_factor_verify') {
      res.status(401).json({ message: 'Invalid or expired verification token' });
      return;
    }

    const user = await User.findById(payload.id) as any;
    if (!user || user.role !== 'admin') {
      res.status(404).json({ message: 'Admin not found' });
      return;
    }

    const codes: string[] = user.twoFactorRecoveryCodes || [];
    if (codes.length === 0) {
      res.status(400).json({ message: 'No recovery codes available' });
      return;
    }

    // Find and consume the matching code
    let matchIndex = -1;
    for (let i = 0; i < codes.length; i++) {
      if (await bcrypt.compare(recoveryCode, codes[i])) {
        matchIndex = i;
        break;
      }
    }

    if (matchIndex === -1) {
      res.status(401).json({ message: 'Invalid recovery code' });
      return;
    }

    // Remove used code, reset lockout
    codes.splice(matchIndex, 1);
    user.twoFactorRecoveryCodes = codes;
    user.failedOtpAttempts = 0;
    user.otpLockedUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    await AdminActivityLog.create({
      admin_id: user._id,
      admin_name: user.name,
      action: 'ADMIN_2FA_RECOVERY_USED',
      target_id: user._id.toString(),
      details: { remainingCodes: codes.length },
    });

    await issueFullTokens(req, res, user);
  } catch (error: any) {
    console.error('[2FA] Recovery error:', error.message);
    res.status(500).json({ message: 'Failed to recover with backup code' });
  }
};

/** Issue full access + refresh tokens and set cookie */
async function issueFullTokens(req: Request, res: Response, user: any, recoveryCodes?: string[]) {
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

  const effectiveAdminRole = user.admin_role || 'super_admin';

  const response: any = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    admin_role: effectiveAdminRole,
    permissions: user.permissions || [],
    token: generateAccessToken(user._id.toString(), user.role),
  };

  // Only include recovery codes on initial 2FA setup (shown once)
  if (recoveryCodes) {
    response.recoveryCodes = recoveryCodes;
    response.recoveryCodesWarning = 'Save these codes securely. They will NOT be shown again.';
  }

  res.json(response);
}
