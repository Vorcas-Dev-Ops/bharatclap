import { Request, Response } from 'express';
import { UserRepository } from '../../repositories/userRepository';
import { AdminLogRepository } from '../../repositories/adminLogRepository';
import bcrypt from 'bcryptjs';

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const role = req.query.role as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const { users, total } = await UserRepository.findWithPagination({
      page,
      limit,
      role,
      status,
      search,
    });
      
    res.json({ data: users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Self or Admin)
export const getUserById = async (req: any, res: Response): Promise<void> => {
  try {
    const targetId = req.params.id;
    if (!targetId) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const requestingUserId = req.user?.id || req.user?._id;
    const isSelf = String(requestingUserId) === String(targetId);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    if (!isSelf && !isAdmin) {
      res.status(403).json({ message: 'Forbidden: Not authorized to access this profile' });
      return;
    }

    const user = await UserRepository.findById(targetId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const { password, password_hash, ...safeUser } = user as any;
    res.json(safeUser);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user count stats (Internal API)
// @route   GET /api/users/stats
// @access  Public (Internal)
export const getUserStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await UserRepository.getUserStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get multiple users by IDs (Internal API)
// @route   POST /api/users/batch
// @access  Public (Internal)
export const getUsersBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({ message: 'Please provide an array of ids' });
      return;
    }
    const validIds = ids
      .map((id: any) => (typeof id === 'object' && id !== null ? (id._id || id.id || String(id)) : String(id)))
      .filter((id: string) => Boolean(id) && id.trim().length > 0);

    if (!validIds.length) {
      res.json([]);
      return;
    }
    const users = await UserRepository.findByIds(validIds);
    res.json(users.map(u => ({
      _id: u.id,
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      profile_image: u.profile_image
    })));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update any user (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = req.params.id;
    const user = await UserRepository.findById(targetId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const updates: Record<string, any> = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.email !== undefined) updates.email = req.body.email;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.profile_image !== undefined) updates.profile_image = req.body.profile_image;
    if (req.body.status !== undefined) updates.status = req.body.status.toLowerCase();
    if (req.body.role !== undefined) updates.role = req.body.role.toLowerCase();

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(req.body.password, salt);
    }

    const updated = await UserRepository.update(user.id, updates);
    if (!updated) {
      res.status(500).json({ message: 'Failed to update user' });
      return;
    }

    res.json({
      _id: updated.id,
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      gender: updated.gender,
      profile_image: updated.profile_image,
      status: updated.status,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a user (Soft Delete)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await UserRepository.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    await UserRepository.softDelete(user.id);
    res.json({ message: 'User moved to trash (Soft Delete)' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminActivityLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { logs, total } = await AdminLogRepository.listLogs({ limit, offset });

    res.json({ success: true, data: logs, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createAdminActivityLogInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { admin_id, admin_name, action, target_id, details, ip_address, user_agent } = req.body;
    
    await AdminLogRepository.createLog({
      adminId: admin_id,
      adminName: admin_name || 'System',
      action,
      targetId: target_id,
      details,
      ipAddress: ip_address,
      userAgent: user_agent
    });
    
    res.status(201).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const searchUsersInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyword } = req.body;
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      res.json([]);
      return;
    }
    const users = await UserRepository.searchUsers(keyword);
    res.json(users.map(u => ({
      _id: u.id,
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role
    })));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
