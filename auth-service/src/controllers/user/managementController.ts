import { Request, Response } from 'express';
import { User, IUser } from '../../models/User';
import bcrypt from 'bcryptjs';

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const [users, total] = await Promise.all([
      User.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments({ isDeleted: false })
    ]);
      
    res.json({ data: users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user count stats (Internal API)
// @route   GET /api/users/stats
// @access  Public (Internal)
export const getUserStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await User.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    let totalCustomers = 0, totalProviders = 0, totalAdmins = 0;
    for (const stat of stats) {
      if (stat._id === 'customer') totalCustomers = stat.count;
      else if (stat._id === 'provider') totalProviders = stat.count;
      else if (stat._id === 'admin') totalAdmins = stat.count;
    }

    res.json({ totalCustomers, totalProviders, totalAdmins });
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
    const users = await User.find({ _id: { $in: ids } }).select('name email phone profile_image').lean();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update any user (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id) as IUser & { _id: string; password?: string };
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.name = req.body.name ?? user.name;
    user.email = req.body.email ?? user.email;
    user.phone = req.body.phone ?? user.phone;
    user.profile_image = req.body.profile_image ?? user.profile_image;

    if (req.body.status) {
      user.status = req.body.status.toLowerCase();
    }

    if (req.body.role) {
      user.role = req.body.role.toLowerCase() as any;
    }

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updated = await user.save();

    res.json({
      _id: updated._id,
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
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    user.isDeleted = true;
    user.status = 'blocked';
    await user.save();
    res.json({ message: 'User moved to trash (Soft Delete)' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
