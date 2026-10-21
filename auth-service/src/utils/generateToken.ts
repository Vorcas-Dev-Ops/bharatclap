import jwt from 'jsonwebtoken';

export const getAccessTokenExpiryDuration = (role?: string): string => {
  if (role === 'provider') {
    return process.env.PROVIDER_JWT_EXPIRES_IN || '365d';
  }
  return process.env.JWT_EXPIRES_IN || '365d';
};

export const getRefreshTokenExpiryDuration = (role?: string): string => {
  if (role === 'provider') {
    return process.env.PROVIDER_REFRESH_EXPIRES || '365d';
  }
  if (role === 'admin' || role === 'super_admin' || role === 'operations_admin' || role === 'finance_admin' || role === 'support_admin') {
    return process.env.ADMIN_REFRESH_EXPIRES || '30d';
  }
  return process.env.CUSTOMER_REFRESH_EXPIRES || '90d';
};

export const getRefreshTokenMaxAgeMs = (role?: string): number => {
  const durationStr = getRefreshTokenExpiryDuration(role);
  const match = durationStr.match(/^(\d+)([dhms])?$/);
  if (!match) return 90 * 24 * 60 * 60 * 1000; // default 90 days

  const num = parseInt(match[1], 10);
  const unit = match[2] || 'd';

  switch (unit) {
    case 'h': return num * 60 * 60 * 1000;
    case 'm': return num * 60 * 1000;
    case 's': return num * 1000;
    case 'd':
    default:
      return num * 24 * 60 * 60 * 1000;
  }
};

export const accessTokenTtlFor = (client?: 'web' | 'mobile', role?: string): string => {
  if (role === 'admin' || role === 'super_admin' || role === 'operations_admin' || role === 'finance_admin' || role === 'support_admin') {
    return '7d';
  }
  if (role === 'provider') {
    return process.env.PROVIDER_JWT_EXPIRES_IN || '365d';
  }
  return client === 'web' ? '24h' : (process.env.JWT_EXPIRES_IN || '365d');
};

export const generateAccessToken = (
  id: string,
  role?: string,
  tokenVersion: number = 0,
  client?: 'web' | 'mobile',
  extraClaims?: Record<string, any>
): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  const expiresIn = accessTokenTtlFor(client, role);
  const payload: Record<string, any> = {
    id,
    token_version: Number(tokenVersion) || 0,
    ...(extraClaims || {})
  };
  if (role) {
    payload.role = role;
  }
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn as any,
  });
};

export const generateRefreshToken = (
  id: string,
  role?: string,
  tokenVersion: number = 0,
  extraClaims?: Record<string, any>
): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is not set');
  }
  const expiresIn = getRefreshTokenExpiryDuration(role);
  // ponytail: Include unique nonce to prevent E11000 token_hash collisions when logging in within the same second
  const payload: Record<string, any> = {
    id,
    role,
    token_version: Number(tokenVersion) || 0,
    nonce: Math.random().toString(36).substring(2) + Date.now(),
    ...(extraClaims || {})
  };
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn as any,
  });
};

// Keep for backwards compatibility
const generateToken = generateAccessToken;
export default generateToken;
