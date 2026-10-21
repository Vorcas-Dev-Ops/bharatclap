import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getUserById } from '../utils/internalApi';
import { ProviderRepository } from '../repositories/providerRepository';
import { readAccessToken, requireRole } from '@bharatclap/shared';

// ponytail: provider routes allow provider + admin roles.
// Admin support staff access provider pages via the frontend.
export const providerOnly = requireRole('provider', 'admin');

export interface AuthRequest extends Request {
  user?: {
    id?: string;
    _id: string;
    role: string;
    subject_type?: string;
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
  const token = readAccessToken(req);
  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[AUTH] JWT_SECRET environment variable is not set');
      res.status(500).json({ message: 'Server misconfigured: auth secret not set' });
      return;
    }
      const decoded = jwt.verify(token, secret) as {
        id: string;
        role?: string;
        subject_type?: string;
        token_version?: number;
        admin_role?: 'super_admin' | 'operations_admin' | 'support_admin' | 'finance_admin';
        name?: string;
        profile_image?: string;
      };

      const user = await getUserById(decoded.id, req.headers.authorization);
      
      if (!user) {
        res.status(401).json({ code: 'TOKEN_VERSION_INVALID', message: 'Session invalidated: user not found or token invalid' });
        return;
      }

      if (user.isDeleted || user.status === 'blocked') {
        res.status(403).json({ code: 'ACCOUNT_BLOCKED', message: 'User account has been blocked or deleted. Please contact support.' });
        return;
      }

      const currentVersion = user.token_version ?? user.tokenVersion;
      const tokenVersion = decoded.token_version ?? 0;
      if (currentVersion === undefined || tokenVersion !== currentVersion) {
        res.status(401).json({ code: 'TOKEN_VERSION_INVALID', message: 'Session invalidated: logged out or token version changed' });
        return;
      }

      req.user = {
        _id: (user._id || user.id || decoded.id).toString(),
        role: user.role,
        subject_type: decoded.subject_type || (user.role === 'admin' ? 'admin' : undefined),
        admin_role: user.admin_role || decoded.admin_role || 'super_admin',
        permissions: user.permissions || [],
        name: user.name,
        profile_image: user.profile_image
      };

      // Provider-specific account status boundary
      if (req.user && req.user.role === 'provider') {
        const provider = await ProviderRepository.findByUserId(req.user._id);
        if (provider) {
          if (provider.deleted_at) {
            res.status(403).json({ code: 'PROVIDER_DELETED', message: 'Provider account has been deleted.' });
            return;
          }
          if (provider.status === 'blocked') {
            res.status(403).json({ code: 'PROVIDER_BLOCKED', message: 'Provider account is blocked. Please contact support.' });
            return;
          }
          (req as any).provider = provider;
        }
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
  };

export const admin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user && (req.user.subject_type === 'admin' || req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

export const checkKitApproval = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (req.user && req.user.role === 'provider') {
    const provider = await ProviderRepository.findByUserId(req.user._id);
    if (!provider || provider.kyc_status !== 'verified') {
      res.status(403).json({ message: 'Account not verified: admin KYC approval required.' });
      return;
    }

    const isFreeAccess = provider.subscription_status === 'active' || provider.subscription_status === 'grace_period';

    const availableCredit = provider.wallet_balance + provider.credit_limit;
    if (!isFreeAccess && (availableCredit < 0 || provider.is_wallet_blocked)) {
      res.status(403).json({ message: `Orders locked: wallet balance has exceeded the -₹${provider.credit_limit || 500} credit limit.` });
      return;
    }
  }
  next();
};
