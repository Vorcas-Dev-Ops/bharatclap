import jwt from 'jsonwebtoken';

export const generateAccessToken = (id: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.sign({ id }, secret, {
    expiresIn: '15m',
  });
};

export const generateRefreshToken = (id: string): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is not set');
  }
  return jwt.sign({ id }, secret, {
    expiresIn: '7d',
  });
};

// Keep for backwards compatibility if needed, but we'll try to migrate callers
const generateToken = generateAccessToken;
export default generateToken;
