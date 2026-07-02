import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: string;
    name?: string;
    profile_image?: string;
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

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error('[AUTH] JWT_SECRET environment variable is not set');
        res.status(500).json({ message: 'Server misconfigured: auth secret not set' });
        return;
      }
      const decoded = jwt.verify(token, secret) as { id: string };

      const user = await User.findById(decoded.id).select('role name profile_image');
      
      if (!user) {
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }
      
      req.user = {
        _id: user._id.toString(),
        role: user.role,
        name: user.name,
        profile_image: user.profile_image
      };
      
      return next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        // Expected — client should refresh via POST /api/users/refresh
        res.status(401).json({ message: 'Not authorized, token expired' });
      } else {
        console.error('[AUTH] Token verification failed:', error.message);
        res.status(401).json({ message: 'Not authorized, token failed' });
      }
      return;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};
