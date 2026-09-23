import { RefreshTokenRepository } from '../repositories/refreshTokenRepository';
import { UserRepository } from '../repositories/userRepository';
import { getDb } from '../config/db';

export const getMaxDevicesForRole = (role?: string): number => {
  if (role === 'provider') return 3;
  if (role === 'admin' || role === 'super_admin' || role === 'operations_admin' || role === 'finance_admin' || role === 'support_admin') {
    return 2;
  }
  return 5; // customer default
};

export const getIdleTimeoutMs = (role?: string): number => {
  if (role === 'provider') return 3650 * 24 * 60 * 60 * 1000; // 10 years (persistent until manual logout)
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
    const pool = getDb();
    const activeSessionsRes = await pool.query(
      `SELECT id FROM auth.refresh_tokens
       WHERE user_id::text = $1 AND revoked = FALSE
       ORDER BY created_at ASC`,
      [userId]
    );

    const activeSessions = activeSessionsRes.rows;
    if (activeSessions.length >= maxDevices) {
      const deleteCount = activeSessions.length - maxDevices + 1;
      const idsToDelete = activeSessions.slice(0, deleteCount).map(s => s.id);
      await pool.query(
        `UPDATE auth.refresh_tokens SET revoked = TRUE, updated_at = NOW() WHERE id = ANY($1::uuid[])`,
        [idsToDelete]
      );
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
  await RefreshTokenRepository.revokeAllForUser(userId);
  await UserRepository.incrementTokenVersion(userId);
};
