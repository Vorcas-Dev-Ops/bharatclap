import { Request, Response } from 'express';
import { Membership } from '../models/Membership';
import mongoose from 'mongoose';
import axios from 'axios';
import { getUsersBatch } from '../utils/internalApi';

const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005';


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

    // Fetch user memberships from payment-service (data owner)
    const umRes = await axios.get(`${PAYMENT_URL}/api/user-memberships?membership_id=${id}`).catch(() => ({ data: [] }));
    const rawUsers: any[] = umRes.data;

    const userIds = rawUsers.map((u: any) => String(u.user_id)).filter(Boolean);
    const users = await getUsersBatch(userIds).catch(() => []);
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
    const membershipsForRole = await Membership.find(filter).select('_id price').lean();
    const validMembershipIds = membershipsForRole.map((m: any) => String(m._id));
    const membershipPriceMap = new Map(membershipsForRole.map((m: any) => [String(m._id), (m as any).price || 0]));

    // Fetch user membership stats from payment-service (data owner)
    const statsRes = await axios.get(`${PAYMENT_URL}/api/user-memberships/stats`).catch(() => ({ data: { activeMembers: 0, paidMemberships: [] } }));
    const { activeMembers = 0, paidMemberships = [] } = statsRes.data;

    const monthlyRevenue = (paidMemberships as any[]).reduce((sum: number, item: any) => {
      if (!validMembershipIds.includes(String(item.membership_id))) return sum;
      return sum + (membershipPriceMap.get(String(item.membership_id)) || 0);
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
