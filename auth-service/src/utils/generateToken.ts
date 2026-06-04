import jwt from 'jsonwebtoken';

const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET || 'e54a5ea657fd1d25d021433b58a9c6e101d63feb4f6549cc9520bd3c2d815222';
  return jwt.sign({ id }, secret, {
    expiresIn: '30d',
  });
};

export default generateToken;
