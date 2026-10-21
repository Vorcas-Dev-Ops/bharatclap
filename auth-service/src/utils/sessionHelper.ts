import { Pool, PoolClient } from 'pg';
import { RefreshTokenRepository } from '../repositories/refreshTokenRepository';
import { UserRepository } from '../repositories/userRepository';
import { AdminRepository } from '../repositories/adminRepository';
import { getDb } from '../config/db';

export type SessionOwner = { userId?: string; adminId?: string };

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

let __testSessionLimitError: Error | null = null;
export const setTestSessionLimitError = (err: Error | null) => {
  __testSessionLimitError = err;
};

/**
 * Enforces maximum device limit for a user or admin by purging the oldest sessions
 */
export const enforceSessionLimit = async (
  owner: SessionOwner | string,
  role?: string,
  client?: Pool | PoolClient
): Promise<void> => {
  if (__testSessionLimitError) {
    throw __testSessionLimitError;
  }
  const isAdmin = typeof owner === 'object' && !!owner.adminId;
  const ownerId = typeof owner === 'string' ? owner : (owner.adminId || owner.userId);
  if (!ownerId) return;

  try {
    const maxDevices = getMaxDevicesForRole(role);
    const dbClient = client || getDb();
    const whereClause = isAdmin ? 'admin_id = $1' : 'user_id::text = $1';
    const activeSessionsRes = await dbClient.query(
      `SELECT id FROM auth.refresh_tokens
       WHERE ${whereClause} AND revoked = FALSE
       ORDER BY created_at ASC`,
      [ownerId]
    );

    const activeSessions = activeSessionsRes.rows;
    if (activeSessions.length > maxDevices) {
      const deleteCount = activeSessions.length - maxDevices;
      const idsToDelete = activeSessions.slice(0, deleteCount).map(s => s.id);
      try {
        await dbClient.query(
          `UPDATE auth.refresh_tokens 
           SET revoked = TRUE, 
               revoked_reason = 'SESSION_LIMIT', 
               updated_at = NOW() 
           WHERE id = ANY($1::uuid[])`,
          [idsToDelete]
        );
      } catch (updateErr: any) {
        if (updateErr.code === '42703') {
          // Fallback before revoked_reason column exists
          await dbClient.query(
            `UPDATE auth.refresh_tokens SET revoked = TRUE, updated_at = NOW() WHERE id = ANY($1::uuid[])`,
            [idsToDelete]
          );
        } else {
          throw updateErr;
        }
      }
    }
  } catch (err: any) {
    console.error('[SESSION] Failed to enforce device limit:', err?.message);
    if (isAdmin || role === 'admin' || role === 'super_admin') {
      throw err; // Fail closed for admin sessions
    }
  }
};

/**
 * Revokes all sessions for a user or admin upon security breach / token reuse detection
 */
export const handleTokenReuseSecurityBreach = async (
  owner: SessionOwner | string
): Promise<void> => {
  const isAdmin = typeof owner === 'object' && !!owner.adminId;
  const ownerId = typeof owner === 'string' ? owner : (owner.adminId || owner.userId);
  if (!ownerId) return;

  console.warn(`[SECURITY ALERT] Refresh token reuse detected for ${isAdmin ? 'admin' : 'user'} ${ownerId}. Revoking all sessions.`);
  if (isAdmin) {
    await RefreshTokenRepository.revokeAllForAdmin(ownerId);
    await AdminRepository.incrementTokenVersion(ownerId);
  } else {
    await RefreshTokenRepository.revokeAllForUser(ownerId);
    await UserRepository.incrementTokenVersion(ownerId);
  }
};
