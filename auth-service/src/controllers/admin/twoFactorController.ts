import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { AdminRepository } from '../../repositories/adminRepository';
import { AdminLogRepository } from '../../repositories/adminLogRepository';
import { issueSession } from '../../services/sessionService';
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

    const admin = await AdminRepository.findById(payload.id);
    if (!admin) {
      res.status(404).json({ message: 'Admin not found' });
      return;
    }

    if (admin.totp_secret) {
      res.status(400).json({ message: '2FA is already enabled' });
      return;
    }

    const appName = process.env.APP_NAME || 'BharatClap Admin';
    const secret = speakeasy.generateSecret({
      name: `${appName} (${admin.email})`,
      issuer: appName,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Store base32 secret temporarily in auth.admins (not yet confirmed until verified)
    await AdminRepository.update(admin.id, { totp_secret: secret.base32 });

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

    const admin = await AdminRepository.findById(payload.id);
    if (!admin || !admin.totp_secret) {
      res.status(400).json({ message: 'Setup not initiated' });
      return;
    }

    const isValid = speakeasy.totp.verify({
      secret: admin.totp_secret,
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

    // Activate 2FA in auth.admins
    await AdminRepository.update(admin.id, {
      two_factor_recovery: hashedCodes,
      failed_otp_attempts: 0,
      last_login: new Date(),
    });

    await AdminLogRepository.createLog({
      adminId: admin.id,
      adminName: admin.name,
      action: 'ADMIN_2FA_ENABLED',
      targetId: admin.id,
      details: { email: admin.email, recoveryCodesGenerated: 8 },
    });

    // Issue full tokens — also return recovery codes (shown ONCE)
    await issueFullTokens(req, res, { ...admin, role: 'admin' }, plainCodes);
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

    const admin = await AdminRepository.findById(payload.id);
    if (!admin) {
      res.status(404).json({ message: 'Admin not found' });
      return;
    }

    // Check lockout
    if (admin.otp_locked_until && new Date(admin.otp_locked_until) > new Date()) {
      const remainingMs = new Date(admin.otp_locked_until).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      res.status(403).json({ message: `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).` });
      return;
    }

    const isValid = speakeasy.totp.verify({
      secret: admin.totp_secret || '',
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      const failedAttempts = (admin.failed_otp_attempts || 0) + 1;

      // Lock after 5 failed attempts for 15 minutes
      if (failedAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await AdminRepository.update(admin.id, {
          failed_otp_attempts: failedAttempts,
          otp_locked_until: lockedUntil,
        });

        await AdminLogRepository.createLog({
          adminId: admin.id,
          adminName: admin.name,
          action: 'ADMIN_2FA_LOCKED',
          targetId: admin.id,
          details: { reason: '5 failed OTP attempts', lockedUntil },
        });

        res.status(403).json({ message: 'Account locked for 15 minutes due to too many failed OTP attempts.' });
        return;
      }

      await AdminRepository.update(admin.id, { failed_otp_attempts: failedAttempts });
      res.status(401).json({
        message: 'Invalid code',
        attemptsRemaining: 5 - failedAttempts,
      });
      return;
    }

    // Success — reset counters
    await AdminRepository.update(admin.id, {
      failed_otp_attempts: 0,
      otp_locked_until: null,
      last_login: new Date(),
    });

    await issueFullTokens(req, res, { ...admin, role: 'admin' });
  } catch (error: any) {
    console.error('[2FA] Verify error:', error.message);
    res.status(500).json({ message: 'Failed to verify 2FA' });
  }
};

/**
 * POST /api/users/admin/2fa/recover
 * Login using a one-time recovery code — bypasses TOTP and lockout.
 */
export const recover2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempToken, recoveryCode } = req.body;
    const payload = verifyTempToken(tempToken);
    if (!payload || payload.purpose !== 'two_factor_verify') {
      res.status(401).json({ message: 'Invalid or expired verification token' });
      return;
    }

    const admin = await AdminRepository.findById(payload.id);
    if (!admin) {
      res.status(404).json({ message: 'Admin not found' });
      return;
    }

    const codes: string[] = admin.two_factor_recovery || [];
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
    await AdminRepository.update(admin.id, {
      two_factor_recovery: codes,
      failed_otp_attempts: 0,
      otp_locked_until: null,
      last_login: new Date(),
    });

    await AdminLogRepository.createLog({
      adminId: admin.id,
      adminName: admin.name,
      action: 'ADMIN_2FA_RECOVERY_USED',
      targetId: admin.id,
      details: { remainingCodes: codes.length },
    });

    await issueFullTokens(req, res, { ...admin, role: 'admin' });
  } catch (error: any) {
    console.error('[2FA] Recovery error:', error.message);
    res.status(500).json({ message: 'Failed to recover with backup code' });
  }
};

/** Issue full access + refresh tokens and set cookie via issueSession */
async function issueFullTokens(req: Request, res: Response, user: any, recoveryCodes?: string[]) {
  const tokenBody = await issueSession(req, res, user, { subject_type: 'admin' });
  const effectiveAdminRole = user.admin_role || 'super_admin';
  const token = tokenBody.token || tokenBody.accessToken;

  const response: any = {
    _id: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    admin_role: effectiveAdminRole,
    permissions: user.permissions || [],
    token,
    accessToken: token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      admin_role: effectiveAdminRole,
      permissions: user.permissions || [],
      token,
      accessToken: token,
      ...tokenBody,
    },
    ...tokenBody,
  };

  if (recoveryCodes) {
    response.recoveryCodes = recoveryCodes;
    response.recoveryCodesWarning = 'Save these codes securely. They will NOT be shown again.';
  }

  res.json(response);
}
