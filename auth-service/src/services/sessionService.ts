import crypto from 'crypto';
import { Request, Response } from 'express';
import { generateAccessToken, generateRefreshToken, getRefreshTokenMaxAgeMs } from '../utils/generateToken';
import { RefreshTokenRepository } from '../repositories/refreshTokenRepository';
import { enforceSessionLimit } from '../utils/sessionHelper';
import { setAuthCookies, clientOf, bodyToken } from '../utils/authCookies';
import { getDb } from '../config/db';

export const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

export const toSessionUser = (u: any) => ({
  _id: u.id,
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  gender: u.gender,
  profile_image: u.profile_image,
});

// Mobile apps read the token from the body; web receives cookies only.
export const sessionResponse = (user: any, tokenBody: Record<string, string>) => {
  const profile = toSessionUser(user);
  return {
    ...profile,
    user: { ...profile, ...tokenBody },
    ...tokenBody,
  };
};

export const issueSession = async (
  req: Request,
  res: Response,
  user: any,
  extraClaims?: Record<string, any>
): Promise<Record<string, string>> => {
  const client = clientOf(req);
  const tokenVersion = user.token_version ?? user.tokenVersion ?? 0;

  const isAdmin = extraClaims?.subject_type === 'admin' || user.role === 'admin' || user.role === 'super_admin';
  const role = isAdmin ? 'admin' : user.role;

  const refreshToken = generateRefreshToken(user.id, role, tokenVersion, extraClaims);
  const maxAgeMs = getRefreshTokenMaxAgeMs(role);

  const dbClient = await getDb().connect();
  try {
    await dbClient.query('BEGIN');

    await RefreshTokenRepository.saveToken({
      userId: isAdmin ? undefined : user.id,
      adminId: isAdmin ? user.id : undefined,
      tokenHash: sha256(refreshToken),
      deviceInfo: (req.headers['user-agent'] as string) || 'Unknown Device',
      ipAddress: req.ip || 'Unknown IP',
      expiresAt: new Date(Date.now() + maxAgeMs),
    }, dbClient);

    await enforceSessionLimit(isAdmin ? { adminId: user.id } : { userId: user.id }, role, dbClient);

    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  const accessToken = generateAccessToken(user.id, role, tokenVersion, client, extraClaims);
  setAuthCookies(res, accessToken, refreshToken, maxAgeMs);

  return bodyToken(client, accessToken);
};
