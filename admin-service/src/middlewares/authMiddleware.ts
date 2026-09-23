import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthClient } from '../clients/auth.client';

const ADMIN_ROLES = ['admin', 'super_admin', 'operations_admin', 'finance_admin', 'support_admin'];

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Attach correlation ID
  (req as any).correlationId = (req.headers['x-correlation-id'] as string) || `corr_${Date.now()}`;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Authentication required: missing or malformed Bearer token',
      errorCode: 'UNAUTHENTICATED'
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[ADMIN-SERVICE AUTH] JWT_SECRET is not configured');
    res.status(500).json({
      success: false,
      message: 'Server configuration error: JWT_SECRET unset',
      errorCode: 'CONFIG_ERROR'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;
    if (!decoded || (!decoded.id && !decoded._id)) {
      res.status(401).json({
        success: false,
        message: 'Invalid token payload: missing subject identifier',
        errorCode: 'INVALID_TOKEN'
      });
      return;
    }

    const userId = decoded.id || decoded._id;
    const tokenRole = (decoded.role || '').toLowerCase();
    let adminRole = decoded.admin_role;
    let userName = decoded.name;
    let permissions = decoded.permissions;

    // If admin_role is not in token claims, query auth-service for authoritative live profile
    if (!adminRole) {
      try {
        const userProfile = await AuthClient.getCustomerProfile(userId);
        if (userProfile) {
          if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
            res.status(403).json({
              success: false,
              message: 'Forbidden: Insufficient privileges for admin control plane',
              errorCode: 'FORBIDDEN_NOT_ADMIN'
            });
            return;
          }
          adminRole = userProfile.admin_role || (userProfile.role === 'super_admin' ? 'super_admin' : 'support_admin');
          userName = userProfile.name;
          permissions = userProfile.permissions;
        }
      } catch (err: any) {
        console.warn('[ADMIN-SERVICE AUTH] Live profile lookup fallback:', err.message);
      }
    }

    if (!adminRole) {
      if (tokenRole === 'super_admin' || tokenRole === 'admin') {
        adminRole = tokenRole === 'super_admin' ? 'super_admin' : 'operations_admin';
      } else if (ADMIN_ROLES.includes(tokenRole)) {
        adminRole = tokenRole;
      }
    }

    if (!adminRole || !ADMIN_ROLES.includes(adminRole)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: User is not authorized to access admin control plane',
        errorCode: 'FORBIDDEN_NOT_ADMIN'
      });
      return;
    }

    (req as any).user = {
      id: userId,
      _id: userId,
      role: adminRole,
      admin_role: adminRole,
      name: userName || decoded.name || 'Admin User',
      permissions: permissions || []
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Authentication token has expired',
        errorCode: 'TOKEN_EXPIRED'
      });
      return;
    }
    res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      errorCode: 'INVALID_TOKEN'
    });
  }
};

