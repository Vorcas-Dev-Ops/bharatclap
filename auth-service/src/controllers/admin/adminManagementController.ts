import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, IUser } from '../../models/User';
import { AdminActivityLog } from '../../models/AdminActivityLog';
import { AuthRequest } from '../../middleware/authMiddleware';

// ponytail: permission strings that grant admin-management power — require explicit escalation confirmation
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

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ message: 'An account with this email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await User.create({
      name,
      email: email.toLowerCase(),
      phone: phone || undefined,
      password: hashedPassword,
      role: 'admin',
      admin_role: admin_role || 'support_admin',
      permissions: permissions || [],
      status: 'active',
      isEmailVerified: true,
      twoFactorEnabled: false, // Must set up on first login
    });

    await AdminActivityLog.create({
      admin_id: req.user!._id,
      admin_name: req.user!.name || 'Unknown',
      action: 'ADMIN_CREATED',
      target_id: newAdmin._id.toString(),
      details: {
        created_email: email,
        admin_role: admin_role || 'support_admin',
        permissions: permissions || [],
      },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.status(201).json({
      _id: newAdmin._id,
      name: newAdmin.name,
      email: newAdmin.email,
      phone: newAdmin.phone,
      admin_role: newAdmin.admin_role,
      permissions: newAdmin.permissions,
      status: newAdmin.status,
      twoFactorEnabled: newAdmin.twoFactorEnabled,
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
    const admins = await User.find({ role: 'admin' })
      .select('name email phone admin_role permissions status twoFactorEnabled lastLogin createdAt failedOtpAttempts otpLockedUntil')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      count: admins.length,
      admins: admins.map(a => ({
        ...a,
        isLocked: !!(a as any).otpLockedUntil && new Date((a as any).otpLockedUntil) > new Date(),
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

    const targetAdmin = await User.findOne({ _id: id, role: 'admin' });
    if (!targetAdmin) {
      res.status(404).json({ message: 'Admin not found' });
      return;
    }

    // Prevent self-demotion of super_admin (safety)
    if (id === req.user!._id && targetAdmin.admin_role === 'super_admin' && admin_role && admin_role !== 'super_admin') {
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

    const changes: Record<string, any> = {};

    if (admin_role !== undefined) {
      targetAdmin.admin_role = admin_role;
      changes.admin_role = admin_role;
    }
    if (permissions !== undefined) {
      targetAdmin.permissions = permissions;
      changes.permissions = permissions;
    }
    if (status !== undefined) {
      targetAdmin.status = status;
      changes.status = status;
    }
    if (unlock2fa) {
      targetAdmin.failedOtpAttempts = 0;
      targetAdmin.otpLockedUntil = undefined;
      changes.unlock2fa = true;
    }

    await targetAdmin.save();

    await AdminActivityLog.create({
      admin_id: req.user!._id,
      admin_name: req.user!.name || 'Unknown',
      action: status === 'blocked' ? 'ADMIN_DEACTIVATED' : unlock2fa ? 'ADMIN_2FA_UNLOCKED' : 'ADMIN_UPDATED',
      target_id: id,
      details: {
        target_email: targetAdmin.email,
        changes,
      },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.json({
      _id: targetAdmin._id,
      name: targetAdmin.name,
      email: targetAdmin.email,
      admin_role: targetAdmin.admin_role,
      permissions: targetAdmin.permissions,
      status: targetAdmin.status,
      twoFactorEnabled: targetAdmin.twoFactorEnabled,
      message: 'Admin updated successfully',
    });
  } catch (error: any) {
    console.error('[ADMIN_MGMT] Update error:', error.message);
    res.status(500).json({ message: 'Failed to update admin' });
  }
};
