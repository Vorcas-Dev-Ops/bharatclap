import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { getCache, setCache } from '../config/redis';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: string;
    admin_role?: 'super_admin' | 'operations_admin' | 'support_admin' | 'finance_admin';
    name?: string;
    profile_image?: string;
  };
}

export const PERMISSION_MATRIX: Record<string, Record<string, string[]>> = {
  super_admin: {
    '*': ['*']
  },
  operations_admin: {
    bookings: ['view', 'update', 'cancel'],
    providers: ['view', 'update', 'release'],
    payments: ['view'],
    refunds: ['view']
  },
  finance_admin: {
    payments: ['view', 'update'],
    refunds: ['view', 'approve', 'reject'],
    payouts: ['view', 'update']
  },
  support_admin: {
    bookings: ['view'],
    providers: ['view'],
    refunds: ['view']
  }
};

export const checkPermission = (resource: string, action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }
    const role = req.user.admin_role || 'super_admin';
    const permissions = PERMISSION_MATRIX[role];
    if (!permissions) {
      res.status(403).json({ message: 'Forbidden: Role not found in permission matrix' });
      return;
    }
    if (permissions['*'] && permissions['*'].includes('*')) {
      return next();
    }
    const resourcePermissions = permissions[resource];
    if (resourcePermissions && (resourcePermissions.includes(action) || resourcePermissions.includes('*'))) {
      return next();
    }
    res.status(403).json({ message: `Forbidden: Insufficient permissions for ${action} on ${resource}` });
  };
};

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
        admin_role: user.admin_role || 'super_admin',
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
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};
