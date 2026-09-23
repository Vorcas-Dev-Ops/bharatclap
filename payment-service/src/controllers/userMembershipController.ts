import { Request, Response } from 'express';
import { MembershipRepository } from '../repositories/membershipRepository';
import { sendNotification } from '../utils/internalApi';

// @desc    Get active membership for a user
// @route   GET /api/user-memberships/user/:userId/active
// @access  Public (Internal)
export const getActiveUserMembership = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(404).json({ message: 'No active membership found' });
      return;
    }

    const activeMembership = await MembershipRepository.getActiveMembership(userId);
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
    const membershipId = req.query.membership_id as string | undefined;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const { records, total } = await MembershipRepository.getMembershipsByPlan({
      membershipId,
      page,
      limit,
    });

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
    const { activeMembers, paidMemberships } = await MembershipRepository.getMembershipStats();
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
    const membership = await MembershipRepository.purchaseMembership({
      userId: user_id,
      membershipId: membership_id,
      durationDays: days,
    });

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
    const membership = await MembershipRepository.renewMembership({
      userId: user_id,
      membershipId: membership_id,
      durationDays: days,
    });

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
    const { expired, expiringSoon } = await MembershipRepository.checkMembershipExpirations();

    for (const membership of expired) {
      sendNotification(
        membership.user_id.toString(),
        'Membership Expired',
        'Your membership has expired. Renew today to get back access to benefits!',
        'system_alert',
        { membership_id: membership._id }
      ).catch(() => {});
    }

    for (const membership of expiringSoon) {
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
      expiringSoonCount: expiringSoon.length,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
