import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getUserById } from '../utils/internalApi';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: string;
  };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const secret = process.env.JWT_SECRET || 'e54a5ea657fd1d25d021433b58a9c6e101d63feb4f6549cc9520bd3c2d815222';
      const decoded = jwt.verify(token, secret) as { id: string };

      const user = await getUserById(decoded.id, req.headers.authorization);
      
      if (!user) {
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }
      
      req.user = {
        _id: user._id.toString(),
        role: user.role
      };
      
      return next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};
