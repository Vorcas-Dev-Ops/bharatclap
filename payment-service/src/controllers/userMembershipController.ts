import { Request, Response } from 'express';
import mongoose, { Schema } from 'mongoose';
import { UserMembership as UserMembershipModel } from '../models/UserMembership';

// @desc    Get active membership for a user
// @route   GET /api/user-memberships/user/:userId/active
// @access  Public (Internal)
export const getActiveUserMembership = async (req: Request, res: Response): Promise<void> => {
  try {
    const activeMembership = await UserMembershipModel.findOne({ 
      user_id: new mongoose.Types.ObjectId(req.params.userId), 
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
    if (req.query.membership_id) {
      filter.membership_id = new mongoose.Types.ObjectId(req.query.membership_id as string);
    }
    const records = await UserMembershipModel.find(filter).sort({ purchase_date: -1 }).lean();
    res.json(records);
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
