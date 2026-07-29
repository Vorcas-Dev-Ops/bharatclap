import jwt from 'jsonwebtoken';

export const getRefreshTokenExpiryDuration = (role?: string): string => {
  if (role === 'provider') {
    return process.env.PROVIDER_REFRESH_EXPIRES || '30d';
  }
  if (role === 'admin' || role === 'super_admin' || role === 'operations_admin' || role === 'finance_admin' || role === 'support_admin') {
    return process.env.ADMIN_REFRESH_EXPIRES || '90d';
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

export const generateAccessToken = (id: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '30m';
  return jwt.sign({ id }, secret, {
    expiresIn: expiresIn as any,
  });
};

export const generateRefreshToken = (id: string, role?: string): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is not set');
  }
  const expiresIn = getRefreshTokenExpiryDuration(role);
  return jwt.sign({ id }, secret, {
    expiresIn: expiresIn as any,
  });
};

// Keep for backwards compatibility
const generateToken = generateAccessToken;
export default generateToken;
