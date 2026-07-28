import { setCache, getCache, deleteCache } from '../config/redis';

export interface AcceptedBookingCache {
  bookingId: string;
  providerId: string;
  acceptedAt: string;
  scheduledTime: string;
  startServiceDeadline: string;
  status: string;
  lastActivityAt: string;
  etaMinutes?: number;
}

const DEFAULT_GRACE_MINUTES = 60; // ponytail: 60 mins default grace period after scheduled time

export const cacheAcceptedBooking = async (
  bookingId: string,
  providerId: string,
  scheduledTime: string | Date,
  etaMinutes: number = 15
): Promise<void> => {
  try {
    const now = new Date();
    const scheduledDate = new Date(scheduledTime);
    const deadlineDate = new Date(scheduledDate.getTime() + DEFAULT_GRACE_MINUTES * 60 * 1000);

    const cacheData: AcceptedBookingCache = {
      bookingId,
      providerId,
      acceptedAt: now.toISOString(),
      scheduledTime: scheduledDate.toISOString(),
      startServiceDeadline: deadlineDate.toISOString(),
      status: 'accepted',
      lastActivityAt: now.toISOString(),
      etaMinutes,
    };

    const ttlSeconds = Math.max(300, Math.round((deadlineDate.getTime() - now.getTime()) / 1000));

    await setCache(`booking:accepted:${bookingId}`, cacheData, ttlSeconds);
    await setCache(`booking:activity:${bookingId}`, now.toISOString(), ttlSeconds);
  } catch (error: any) {
    console.error(`[CACHE SERVICE] Failed to cache accepted booking ${bookingId}:`, error?.message || error);
  }
};

export const refreshBookingActivity = async (bookingId: string): Promise<void> => {
  try {
    const raw = await getCache(`booking:accepted:${bookingId}`);
    if (raw) {
      const data: AcceptedBookingCache = JSON.parse(raw);
      data.lastActivityAt = new Date().toISOString();
      await setCache(`booking:accepted:${bookingId}`, data, 3600);
      await setCache(`booking:activity:${bookingId}`, data.lastActivityAt, 3600);
    }
  } catch (error: any) {
    console.error(`[CACHE SERVICE] Failed to refresh activity for ${bookingId}:`, error?.message || error);
  }
};

export const clearBookingCache = async (bookingId: string): Promise<void> => {
  try {
    await deleteCache(`booking:*:${bookingId}`);
  } catch (error: any) {
    console.error(`[CACHE SERVICE] Failed to clear cache for ${bookingId}:`, error?.message || error);
  }
};
