import { Request, Response, NextFunction } from 'express';
import { AdminPermission } from '../types/permissions';
import { RolePermissionsMap } from '../config/permissions.config';

export const requirePermission = (permission: AdminPermission) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || !user.role) {
      res.status(401).json({
        success: false,
        message: 'Authentication required: no active admin session',
        errorCode: 'UNAUTHENTICATED',
        correlationId: (req as any).correlationId || `corr_${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userRole = (user.role || '').toLowerCase();

    // super_admin has global access across all permissions
    if (userRole === 'super_admin') {
      return next();
    }

    // Check custom granular permissions if populated
    if (Array.isArray(user.permissions) && user.permissions.includes(permission)) {
      return next();
    }

    const allowed = RolePermissionsMap[userRole] || [];
    if (allowed.includes(permission)) {
      return next();
    }

    res.status(403).json({
      success: false,
      message: `Forbidden: Missing required permission [${permission}] for role [${userRole}]`,
      errorCode: 'FORBIDDEN_PERMISSION',
      correlationId: (req as any).correlationId || `corr_${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
  };
};

