import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';

export const getMaxDevicesForRole = (role?: string): number => {
  if (role === 'provider') return 3;
  if (role === 'admin' || role === 'super_admin' || role === 'operations_admin' || role === 'finance_admin' || role === 'support_admin') {
    return 2;
  }
  return 5; // customer default
};

export const getIdleTimeoutMs = (role?: string): number => {
  if (role === 'provider') return 14 * 24 * 60 * 60 * 1000; // 14 days
  if (role === 'admin' || role === 'super_admin' || role === 'operations_admin' || role === 'finance_admin' || role === 'support_admin') {
    return 7 * 24 * 60 * 60 * 1000; // 7 days
  }
  return 30 * 24 * 60 * 60 * 1000; // 30 days for customer
};

/**
 * Enforces maximum device limit for a user by purging the oldest sessions
 */
export const enforceSessionLimit = async (userId: string, role?: string): Promise<void> => {
  try {
    const maxDevices = getMaxDevicesForRole(role);
    const activeSessions = await RefreshToken.find({ user_id: userId, revoked: false })
      .sort({ createdAt: 1 }); // oldest first

    if (activeSessions.length >= maxDevices) {
      const sessionsToDeleteCount = activeSessions.length - maxDevices + 1;
      const idsToDelete = activeSessions.slice(0, sessionsToDeleteCount).map((s) => s._id);
      await RefreshToken.deleteMany({ _id: { $in: idsToDelete } });
    }
  } catch (err: any) {
    console.error('[SESSION] Failed to enforce device limit:', err?.message);
  }
};

/**
 * Revokes all sessions for a user upon security breach / token reuse detection
 */
export const handleTokenReuseSecurityBreach = async (userId: string): Promise<void> => {
  console.warn(`[SECURITY ALERT] Refresh token reuse detected for user ${userId}. Revoking all sessions.`);
  await RefreshToken.deleteMany({ user_id: userId });
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
};
