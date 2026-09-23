import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../../repositories/userRepository';
import { AdminLogRepository } from '../../repositories/adminLogRepository';
import { AuthRequest } from '../../middleware/authMiddleware';

// permission strings that grant admin-management power — require explicit escalation confirmation
const ESCALATION_PERMISSIONS = ['admin_management:create', 'admin_management:edit', 'admin_management:deactivate', 'admin_management:*'];

/**
 * POST /api/users/admin/manage-admins
 * Create a new admin account. Super_admin only.
 */
export const createAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, phone, password, admin_role, permissions, confirmEscalation } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: 'Name, email, and password are required' });
      return;
    }

    // Check if granting admin_management permissions — require explicit confirmation
    const grantsAdminMgmt = (permissions || []).some((p: string) => ESCALATION_PERMISSIONS.includes(p));
    if (grantsAdminMgmt && !confirmEscalation) {
      res.status(400).json({
        message: 'Creating an admin with admin_management permissions requires confirmEscalation: true',
        requiresEscalationConfirmation: true,
      });
      return;
    }

    const existing = await UserRepository.findByEmail(email.toLowerCase());
    if (existing) {
      res.status(409).json({ message: 'An account with this email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await UserRepository.create({
      name,
      email: email.toLowerCase(),
      phone: phone || null,
      password_hash: hashedPassword,
      role: 'admin',
      admin_role: admin_role || 'support_admin',
      permissions: permissions || [],
      status: 'active',
      is_email_verified: true,
    });

    const adminUserId = req.user?.id || req.user?._id;
    await AdminLogRepository.createLog({
      adminId: adminUserId,
      adminName: req.user?.name || 'Unknown',
      action: 'ADMIN_CREATED',
      targetId: newAdmin.id,
      details: {
        created_email: email,
        admin_role: admin_role || 'support_admin',
        permissions: permissions || [],
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });

    res.status(201).json({
      _id: newAdmin.id,
      id: newAdmin.id,
      name: newAdmin.name,
      email: newAdmin.email,
      phone: newAdmin.phone,
      admin_role: newAdmin.admin_role,
      permissions: newAdmin.permissions,
      status: newAdmin.status,
      twoFactorEnabled: newAdmin.two_factor_enabled,
      message: 'Admin created. They must set up 2FA on first login.',
    });
  } catch (error: any) {
    console.error('[ADMIN_MGMT] Create error:', error.message);
    res.status(500).json({ message: 'Failed to create admin' });
  }
};

/**
 * GET /api/users/admin/manage-admins
 * List all admin accounts with role/status/permissions.
 */
export const listAdmins = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const admins = await UserRepository.listAdmins();

    res.json({
      count: admins.length,
      admins: admins.map(a => ({
        ...a,
        isLocked: !!a.otp_locked_until && new Date(a.otp_locked_until) > new Date(),
      })),
    });
  } catch (error: any) {
    console.error('[ADMIN_MGMT] List error:', error.message);
    res.status(500).json({ message: 'Failed to list admins' });
  }
};

/**
 * PATCH /api/users/admin/manage-admins/:id
 * Edit admin: change role, permissions, deactivate/reactivate, unlock 2FA.
 */
export const updateAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { admin_role, permissions, status, unlock2fa, confirmEscalation } = req.body;

    const targetAdmin = await UserRepository.findById(id);
    if (!targetAdmin || targetAdmin.role !== 'admin') {
      res.status(404).json({ message: 'Admin not found' });
      return;
    }

    const currentUserId = req.user?.id || req.user?._id;
    // Prevent self-demotion of super_admin (safety)
    if (id === currentUserId && targetAdmin.admin_role === 'super_admin' && admin_role && admin_role !== 'super_admin') {
      res.status(400).json({ message: 'Cannot demote your own super_admin role' });
      return;
    }

    // Check escalation confirmation for admin_management permissions
    if (permissions) {
      const grantsAdminMgmt = permissions.some((p: string) => ESCALATION_PERMISSIONS.includes(p));
      if (grantsAdminMgmt && !confirmEscalation) {
        res.status(400).json({
          message: 'Granting admin_management permissions requires confirmEscalation: true',
          requiresEscalationConfirmation: true,
        });
        return;
      }
    }

    const updates: Record<string, any> = {};
    const changes: Record<string, any> = {};

    if (admin_role !== undefined) {
      updates.admin_role = admin_role;
      changes.admin_role = admin_role;
    }
    if (permissions !== undefined) {
      updates.permissions = permissions;
      changes.permissions = permissions;
    }
    if (status !== undefined) {
      updates.status = status;
      changes.status = status;
    }
    if (unlock2fa) {
      updates.failed_otp_attempts = 0;
      updates.otp_locked_until = null;
      changes.unlock2fa = true;
    }

    const updated = await UserRepository.update(targetAdmin.id, updates);

    await AdminLogRepository.createLog({
      adminId: currentUserId,
      adminName: req.user?.name || 'Unknown',
      action: status === 'blocked' ? 'ADMIN_DEACTIVATED' : unlock2fa ? 'ADMIN_2FA_UNLOCKED' : 'ADMIN_UPDATED',
      targetId: id,
      details: {
        target_email: targetAdmin.email,
        changes,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });

    res.json({
      _id: updated?.id,
      id: updated?.id,
      name: updated?.name,
      email: updated?.email,
      admin_role: updated?.admin_role,
      permissions: updated?.permissions,
      status: updated?.status,
      twoFactorEnabled: updated?.two_factor_enabled,
      message: 'Admin updated successfully',
    });
  } catch (error: any) {
    console.error('[ADMIN_MGMT] Update error:', error.message);
    res.status(500).json({ message: 'Failed to update admin' });
  }
};
