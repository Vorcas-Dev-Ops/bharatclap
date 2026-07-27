import { Request, Response } from 'express';
import mongoose, { Schema } from 'mongoose';
import { UserMembership as UserMembershipModel } from '../models/UserMembership';

// @desc    Get active membership for a user
// @route   GET /api/user-memberships/user/:userId/active
// @access  Public (Internal)
export const getActiveUserMembership = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(404).json({ message: 'No active membership found' });
      return;
    }

    const activeMembership = await UserMembershipModel.findOne({ 
      user_id: new mongoose.Types.ObjectId(userId), 
      membership_status: 'active' 
    }).lean();

    if (!activeMembership) {
      res.status(404).json({ message: 'No active membership found' });
      return;
    }

    res.json(activeMembership);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all user memberships, optionally filtered by membership_id
// @route   GET /api/user-memberships?membership_id=xxx
// @access  Internal
export const getUserMembershipsByPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    if (req.query.membership_id && mongoose.Types.ObjectId.isValid(req.query.membership_id as string)) {
      filter.membership_id = new mongoose.Types.ObjectId(req.query.membership_id as string);
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const [records, total] = await Promise.all([
      UserMembershipModel.find(filter)
        .sort({ purchase_date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserMembershipModel.countDocuments(filter)
    ]);

    res.json({ data: records, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user membership aggregate stats
// @route   GET /api/user-memberships/stats
// @access  Internal
export const getUserMembershipsStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeMembers = await UserMembershipModel.countDocuments({ membership_status: 'active' });
    const paidMemberships = await UserMembershipModel.find({
      payment_status: 'paid',
      purchase_date: { $gte: thirtyDaysAgo }
    }).select('membership_id').lean();

    res.json({ activeMembers, paidMemberships });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
