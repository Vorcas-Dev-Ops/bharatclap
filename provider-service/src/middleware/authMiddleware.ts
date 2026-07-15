import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getUserById } from '../utils/internalApi';
import { Provider } from '../models/Provider';

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

      const user = await getUserById(decoded.id, req.headers.authorization);
      
      if (!user) {
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }
      
      req.user = {
        _id: user._id.toString(),
        role: user.role,
        admin_role: user.admin_role || 'super_admin',
        name: user.name,
        profile_image: user.profile_image
      };
      
      return next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
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

export const checkKitApproval = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (req.user && req.user.role === 'provider') {
    const provider = await Provider.findOne({ user_id: req.user._id });
    if (!provider || provider.kyc_status !== 'verified') {
      res.status(403).json({ message: 'Account not verified: admin KYC approval required.' });
      return;
    }
    if (!provider.kitPurchased) {
      res.status(403).json({ message: 'Orders locked: starter kit purchase required.' });
      return;
    }
  }
  next();
};
