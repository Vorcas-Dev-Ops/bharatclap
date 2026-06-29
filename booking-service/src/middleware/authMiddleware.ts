import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { getCache, setCache } from '../config/redis';

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

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET is not defined');
      }

      // Verify token locally
      const decoded = jwt.verify(token, secret) as { id: string };

      // Try fetching user from cache
      const cacheKey = `user:profile:${decoded.id}`;
      let user: any = null;
      const cached = await getCache(cacheKey);

      if (cached) {
        user = JSON.parse(cached);
      } else {
        // Fallback to auth-service
        const response = await axios.get(`${AUTH_SERVICE_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        user = response.data;
        if (user) {
          await setCache(cacheKey, user, 300); // 5-minute TTL
        }
      }
      
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
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ message: 'Not authorized, token expired' });
        return;
      }
      const status = error?.response?.status || 401;
      const message = error?.response?.data?.message || 'Not authorized, token failed';
      // Suppress expected expiry noise — client will refresh automatically
      if (message !== 'Not authorized, token expired') {
        console.error('Auth middleware error:', error.message);
      }
      res.status(status).json({ message });
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
