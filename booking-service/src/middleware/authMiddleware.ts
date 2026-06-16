import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: string;
    name?: string;
    profile_image?: string;
  };
}

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Instead of parsing JWT locally and hitting a shared DB,
      // hit the auth-service API to validate token & get user profile.
      const response = await axios.get(`${AUTH_SERVICE_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const user = response.data;
      
      if (!user) {
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }
      
      req.user = {
        _id: user._id,
        role: user.role,
        name: user.name,
        profile_image: user.profile_image
      };
      
      return next();
    } catch (error: any) {
      console.error('Auth middleware error:', error.message);
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
