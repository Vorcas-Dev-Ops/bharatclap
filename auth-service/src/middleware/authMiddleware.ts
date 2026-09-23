import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: string;
    admin_role?: 'super_admin' | 'operations_admin' | 'support_admin' | 'finance_admin';
    permissions?: string[];
    name?: string;
    profile_image?: string;
  };
}

export const PERMISSION_MATRIX: Record<string, Record<string, string[]>> = {
  super_admin: {
    '*': ['*']
  },
  operations_admin: {
    users: ['view', 'update'],
    bookings: ['view', 'update', 'cancel'],
    providers: ['view', 'update', 'release'],
    payments: ['view'],
    refunds: ['view']
  },
  finance_admin: {
    users: ['view'],
    payments: ['view', 'update'],
    refunds: ['view', 'approve', 'reject'],
    payouts: ['view', 'update']
  },
  support_admin: {
    users: ['view'],
    bookings: ['view'],
    providers: ['view'],
    refunds: ['view']
  }
};

/**
 * Check if an admin has permission for resource:action.
 * Priority: per-admin permissions[] → PERMISSION_MATRIX fallback.
 * Permissions are read from the DB-fetched user (live on every request).
 */
function hasPermission(user: AuthRequest['user'], resource: string, action: string): boolean {
  if (!user) return false;

  const adminRole = (user.admin_role || '').toLowerCase();
  const isSuperAdmin = adminRole === 'super_admin';

  // Super admin with no custom permissions → full access
  if (isSuperAdmin && (!user.permissions || user.permissions.length === 0)) {
    return true;
  }

  // Check per-admin permissions[] if populated
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions.some(p => {
      const [r, a] = p.split(':');
      return (r === '*' || r === resource) && (a === '*' || a === action);
    });
  }

  // Fallback to PERMISSION_MATRIX for backward compatibility
  const matrix = PERMISSION_MATRIX[adminRole];
  if (!matrix) return isSuperAdmin; // unknown role → deny unless super_admin
  if (matrix['*']?.includes('*')) return true;
  const resourcePerms = matrix[resource];
  return !!resourcePerms && (resourcePerms.includes(action) || resourcePerms.includes('*'));
}

export const checkPermission = (resource: string, action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    if (hasPermission(req.user, resource, action)) {
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

      const user = await User.findById(decoded.id).select('role admin_role permissions name profile_image');
      
      if (!user) {
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }
      
      const uRole = user.role as string;
      const isAdmin = uRole === 'admin' || uRole === 'super_admin';
      req.user = {
        _id: user._id.toString(),
        role: user.role,
        admin_role: isAdmin ? (user.admin_role || (uRole === 'super_admin' ? 'super_admin' : 'operations_admin')) : undefined,
        permissions: user.permissions || [],
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

// Optional: Decodes token if present but does NOT block unauthenticated requests.
// Used for routes that can be called both publicly and by logged-in users.
export const optionalProtect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET;
      if (secret) {
        const decoded = jwt.verify(token, secret) as { id: string };
        const user = await User.findById(decoded.id).select('role admin_role name profile_image');
        if (user) {
          const uRole = user.role as string;
          req.user = {
            _id: user._id.toString(),
            role: user.role,
            admin_role: user.admin_role || (uRole === 'admin' || uRole === 'super_admin' ? 'super_admin' : 'support_admin'),
            name: user.name,
            profile_image: user.profile_image
          };
        }
      }
    }
  } catch {
    // Ignore token errors — this middleware is optional
  }
  next();
};
