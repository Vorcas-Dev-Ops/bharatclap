import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getUserById } from '../utils/internalApi';
import { Provider } from '../models/Provider';

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

/**
 * Check if an admin has permission for resource:action.
 * Priority: per-admin permissions[] → PERMISSION_MATRIX fallback.
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

  // Fallback to PERMISSION_MATRIX
  const matrix = PERMISSION_MATRIX[adminRole];
  if (!matrix) return isSuperAdmin;
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

    // IMMUTABLE AUDIT LOG RULE: Delete audit logs is prohibited for ALL roles
    if (resource === 'audit_logs' && action === 'delete') {
      res.status(403).json({ message: 'Forbidden: Audit logs are immutable and cannot be deleted by any role.' });
      return;
    }

    // SUPER ADMIN ONLY RULE: Freeze and Unfreeze wallet are strictly restricted to Super Admin
    if (action === 'freeze_wallet' || action === 'unfreeze_wallet') {
      const adminRole = (req.user.admin_role || '').toLowerCase();
      if (adminRole !== 'super_admin') {
        res.status(403).json({ message: `Forbidden: Only Super Admin has permission to perform ${action}.` });
        return;
      }
      return next();
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
      const decoded = jwt.verify(token, secret) as { id: string; role?: string; admin_role?: 'super_admin' | 'operations_admin' | 'support_admin' | 'finance_admin'; name?: string; profile_image?: string };

      const user = await getUserById(decoded.id, req.headers.authorization);
      
      if (user) {
        req.user = {
          _id: user._id.toString(),
          role: user.role,
          admin_role: user.admin_role || 'super_admin',
          permissions: user.permissions || [],
          name: user.name,
          profile_image: user.profile_image
        };
      } else if (decoded && decoded.id && decoded.role) {
        // ponytail: fail closed — JWT fallback gets no permissions (forces matrix fallback)
        req.user = {
          _id: decoded.id,
          role: decoded.role,
          admin_role: decoded.admin_role,
          permissions: [],
          name: decoded.name,
          profile_image: decoded.profile_image
        };
      } else {
        console.warn('[AUTH] User lookup failed and JWT missing role claim — rejecting');
        res.status(401).json({ message: 'Not authorized, unable to verify user' });
        return;
      }
      
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

    const isFreeAccess = provider.isFreeAccessEnabled || provider.subscriptionStatus === 'active' || provider.subscriptionStatus === 'grace_period';

    if (!isFreeAccess && !provider.kitPurchased) {
      res.status(403).json({ message: 'Orders locked: starter kit purchase required.' });
      return;
    }
    if (!isFreeAccess && (provider.availableCredit < 0 || provider.isWalletBlocked)) {
      res.status(403).json({ message: `Orders locked: wallet balance has exceeded the -₹${provider.creditLimit || 500} credit limit.` });
      return;
    }
  }
  next();
};
