import { Request, Response } from 'express';
import { Membership } from '../models/Membership';
import mongoose, { Schema } from 'mongoose';

// Lazy loading connections for cross-db joins
let paymentConnection: mongoose.Connection | null = null;
let UserMembershipModel: any = null;

let authConnection: mongoose.Connection | null = null;
let UserModel: any = null;

const getPaymentConnection = () => {
  if (!paymentConnection) {
    const paymentDbURI = process.env.PAYMENT_DB_URI || 'mongodb://localhost:27017/payment_db';
    paymentConnection = mongoose.createConnection(paymentDbURI);
  }
  return paymentConnection;
};

const getUserMembershipModel = () => {
  if (!UserMembershipModel) {
    UserMembershipModel = getPaymentConnection().model('UserMembership', new Schema({}, { strict: false }), 'usermemberships');
  }
  return UserMembershipModel;
};

const getAuthConnection = () => {
  if (!authConnection) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    authConnection = mongoose.createConnection(authDbURI);
  }
  return authConnection;
};

const getUserModel = () => {
  if (!UserModel) {
    UserModel = getAuthConnection().model('User', new Schema({}, { strict: false }), 'users');
  }
  return UserModel;
};

// @desc    Create a membership plan
// @route   POST /api/memberships
// @access  Private/Admin
export const createMembership = async (req: Request, res: Response): Promise<void> => {
  try {
    const membership = new Membership(req.body);
    await membership.save();
    res.status(201).json({ message: 'Membership created successfully', membership });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all membership plans
// @route   GET /api/memberships
// @access  Public
export const getAllMemberships = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.query;
    const filter: any = {};
    if (role) {
      if (role === 'user') {
        // Treat missing 'role' field as 'user' for backwards compatibility
        filter.$or = [{ role: 'user' }, { role: { $exists: false } }];
      } else {
        filter.role = role;
      }
    }
    const memberships = await Membership.find(filter).sort({ createdAt: -1 });
    res.status(200).json(memberships);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update membership plan
// @route   PUT /api/memberships/:id
// @access  Private/Admin
export const updateMembership = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const membership = await Membership.findByIdAndUpdate(id, req.body, { new: true });
    if (!membership) {
      res.status(404).json({ message: 'Membership not found' });
      return;
    }
    res.status(200).json({ message: 'Membership updated successfully', membership });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete membership plan
// @route   DELETE /api/memberships/:id
// @access  Private/Admin
export const deleteMembership = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const membership = await Membership.findByIdAndDelete(id);
    if (!membership) {
      res.status(404).json({ message: 'Membership not found' });
      return;
    }
    res.status(200).json({ message: 'Membership deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users subscribed to a specific membership
// @route   GET /api/memberships/:id/users
// @access  Private/Admin
export const getMembershipUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const UMembership = getUserMembershipModel();
    const rawUsers = await UMembership.find({ membership_id: new mongoose.Types.ObjectId(id) })
      .sort({ purchase_date: -1 })
      .lean();

    const userIds = rawUsers.map((u: any) => u.user_id).filter(Boolean);
    const UModel = getUserModel();
    const users = await UModel.find({ _id: { $in: userIds } }).select('name email phone profile_image').lean();
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));

    const membership = await Membership.findById(id).select('name').lean();

    const result = rawUsers.map((item: any) => ({
      ...item,
      user_id: userMap.get(String(item.user_id)) || item.user_id,
      membership_id: membership || item.membership_id
    }));

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get membership stats
// @route   GET /api/memberships/stats
// @access  Private/Admin
export const getMembershipStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.query;
    const filter: any = {};
    if (role) {
      if (role === 'user') {
        filter.$or = [{ role: 'user' }, { role: { $exists: false } }];
      } else {
        filter.role = role;
      }
    }

    const totalPlans = await Membership.countDocuments(filter);
    
    // Get matching membership IDs to filter user memberships
    const membershipsForRole = await Membership.find(filter).select('_id').lean();
    const validMembershipIds = membershipsForRole.map(m => m._id);
    
    const UMembership = getUserMembershipModel();
    const activeMembers = await UMembership.countDocuments({ 
      membership_status: 'active',
      membership_id: { $in: validMembershipIds }
    });
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const paidMemberships = await UMembership.find({ 
      payment_status: 'paid',
      purchase_date: { $gte: thirtyDaysAgo },
      membership_id: { $in: validMembershipIds }
    }).lean();
    
    const paidMembershipIds = paidMemberships.map((p: any) => p.membership_id).filter(Boolean);
    const membershipsList = await Membership.find({ _id: { $in: paidMembershipIds } }).select('price').lean();
    const membershipMap = new Map(membershipsList.map((m: any) => [String(m._id), m]));

    const monthlyRevenue = paidMemberships.reduce((sum: number, item: any) => {
      const price = membershipMap.get(String(item.membership_id))?.price || 0;
      return sum + price;
    }, 0);

    res.status(200).json({
      totalPlans,
      activeMembers,
      monthlyRevenue,
      premiumUsers: activeMembers
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
