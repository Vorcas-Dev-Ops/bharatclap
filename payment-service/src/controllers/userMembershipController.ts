import { Request, Response } from 'express';
import mongoose, { Schema } from 'mongoose';
import { UserMembership as UserMembershipModel } from '../models/UserMembership';
import { sendNotification } from '../utils/internalApi';

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

// @desc    Purchase membership plan
// @route   POST /api/user-memberships/purchase
// @access  Private
export const purchaseMembership = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, membership_id, duration_days } = req.body;
    if (!user_id || !membership_id) {
      res.status(400).json({ message: 'user_id and membership_id are required' });
      return;
    }

    const days = Number(duration_days) || 30;
    const expiry_date = new Date();
    expiry_date.setDate(expiry_date.getDate() + days);

    // Deactivate previous active memberships for this user
    await UserMembershipModel.updateMany(
      { user_id: new mongoose.Types.ObjectId(user_id), membership_status: 'active' },
      { $set: { membership_status: 'expired' } }
    );

    const membership = await UserMembershipModel.create({
      user_id: new mongoose.Types.ObjectId(user_id),
      membership_id: new mongoose.Types.ObjectId(membership_id),
      purchase_date: new Date(),
      expiry_date,
      payment_status: 'paid',
      membership_status: 'active'
    });

    // Trigger Membership Purchased notification
    sendNotification(
      user_id.toString(),
      'Membership Purchased',
      'Thank you! Your membership plan has been successfully activated.',
      'system_alert',
      { membership_id: membership._id }
    ).catch(err => console.error('[NOTIFICATION] Failed to send membership purchased notification:', err));

    res.status(201).json({ success: true, data: membership });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Renew membership plan
// @route   POST /api/user-memberships/renew
// @access  Private
export const renewMembership = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, membership_id, duration_days } = req.body;
    if (!user_id || !membership_id) {
      res.status(400).json({ message: 'user_id and membership_id are required' });
      return;
    }

    const days = Number(duration_days) || 30;

    let membership = await UserMembershipModel.findOne({
      user_id: new mongoose.Types.ObjectId(user_id),
      membership_id: new mongoose.Types.ObjectId(membership_id),
      membership_status: 'active'
    });

    if (membership) {
      const currentExpiry = new Date(membership.expiry_date);
      currentExpiry.setDate(currentExpiry.getDate() + days);
      membership.expiry_date = currentExpiry;
      membership.expiring_soon_reminder_sent = false; // Reset reminder flag on renewal
      await membership.save();
    } else {
      const expiry_date = new Date();
      expiry_date.setDate(expiry_date.getDate() + days);
      membership = await UserMembershipModel.create({
        user_id: new mongoose.Types.ObjectId(user_id),
        membership_id: new mongoose.Types.ObjectId(membership_id),
        purchase_date: new Date(),
        expiry_date,
        payment_status: 'paid',
        membership_status: 'active'
      });
    }

    // Trigger Membership Renewed notification
    sendNotification(
      user_id.toString(),
      'Membership Renewed',
      'Your membership plan has been successfully renewed.',
      'system_alert',
      { membership_id: membership._id }
    ).catch(err => console.error('[NOTIFICATION] Failed to send membership renewed notification:', err));

    res.status(200).json({ success: true, data: membership });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Scan and process membership expirations and alert reminders
// @route   POST /api/user-memberships/check-expirations
// @access  Internal/Admin
export const checkMembershipExpirations = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // 1. Process Expired Memberships
    const expired = await UserMembershipModel.find({
      membership_status: 'active',
      expiry_date: { $lt: now }
    });

    for (const membership of expired) {
      membership.membership_status = 'expired';
      await membership.save();

      sendNotification(
        membership.user_id.toString(),
        'Membership Expired',
        'Your membership has expired. Renew today to get back access to benefits!',
        'system_alert',
        { membership_id: membership._id }
      ).catch(() => {});
    }

    // 2. Alert Expiring Soon Memberships (expiring in <= 3 days, reminder not sent yet)
    const expiringSoon = await UserMembershipModel.find({
      membership_status: 'active',
      expiry_date: { $gte: now, $lte: threeDaysFromNow },
      expiring_soon_reminder_sent: { $ne: true }
    });

    for (const membership of expiringSoon) {
      membership.expiring_soon_reminder_sent = true;
      await membership.save();

      sendNotification(
        membership.user_id.toString(),
        'Membership Expiring Soon',
        `Your membership is expiring on ${new Date(membership.expiry_date).toLocaleDateString()}. Renew now to keep enjoying your benefits!`,
        'system_alert',
        { membership_id: membership._id }
      ).catch(() => {});
    }

    res.json({
      success: true,
      expiredCount: expired.length,
      expiringSoonCount: expiringSoon.length
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
