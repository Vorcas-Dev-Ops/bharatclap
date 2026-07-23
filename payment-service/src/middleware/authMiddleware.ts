import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getUserById } from '../utils/internalApi';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: string;
    admin_role?: 'super_admin' | 'operations_admin' | 'support_admin' | 'finance_admin';
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
  let token: string | undefined;

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
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const internalKey = req.headers['x-internal-service-key'];
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;
  if (expectedKey && internalKey === expectedKey) {
    return next();
  }
  if (!expectedKey && internalKey) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized internal service request' });
};

