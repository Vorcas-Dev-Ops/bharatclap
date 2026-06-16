import jwt from 'jsonwebtoken';

export const generateAccessToken = (id: string): string => {
  const secret = process.env.JWT_SECRET || 'e54a5ea657fd1d25d021433b58a9c6e101d63feb4f6549cc9520bd3c2d815222';
  return jwt.sign({ id }, secret, {
    expiresIn: '15m',
  });
};

export const generateRefreshToken = (id: string): string => {
  const secret = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key_123';
  return jwt.sign({ id }, secret, {
    expiresIn: '7d',
  });
};

// Keep for backwards compatibility if needed, but we'll try to migrate callers
const generateToken = generateAccessToken;
export default generateToken;
