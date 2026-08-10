import { Request, Response, NextFunction } from 'express';
import { AdminPermission } from '../types/permissions';
import { RolePermissionsMap } from '../config/permissions.config';

export const requirePermission = (permission: AdminPermission) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req as any).user?.role || 'super_admin';
    const allowed = RolePermissionsMap[userRole] || [];

    if (allowed.includes(permission) || userRole === 'super_admin') {
      return next();
    }

    res.status(403).json({
      success: false,
      message: `Forbidden: Missing required permission [${permission}]`,
      errorCode: 'FORBIDDEN_PERMISSION',
      correlationId: (req as any).correlationId || `corr_${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
  };
};
