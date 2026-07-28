import axios from 'axios';

const internalAxios = axios.create({
  timeout: 3000 // 3s timeout for internal calls to prevent cumulative API Gateway timeout
});

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002';
const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:5006';

const DEFAULT_INTERNAL_KEY = '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

/**
 * Returns the x-internal-service-key header for service-to-service calls.
 * All internal/batch endpoints require this header for authentication.
 */
const internalHeaders = () => {
  const key = process.env.INTERNAL_SERVICE_KEY || DEFAULT_INTERNAL_KEY;
  return { 'x-internal-service-key': key };
};

// Types for responses
export interface InternalUser {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  profile_image?: string;
}

export interface InternalAddress {
  _id: string;
  address_line?: string;
  city?: string;
  pincode?: string;
  coordinates?: any;
}

export interface InternalProvider {
  _id: string;
  user_id: string | any;
  distance?: number;
}

export interface InternalCategory {
  _id: string;
  category_name?: string;
  icon?: string;
}

export interface InternalService {
  _id: string;
  service_name?: string;
  category_id?: string | any;
}

export interface InternalSubService {
  _id: string;
  subservice_name?: string;
  service_id?: string | any;
}

// Fetch Users Batch
export const getUsersBatch = async (ids: string[]): Promise<InternalUser[]> => {
  if (ids.length === 0) return [];
  try {
    const response = await internalAxios.post(`${AUTH_SERVICE_URL}/api/users/batch`, { ids }, {
      headers: internalHeaders()
    });
    return response.data;
  } catch (error: any) {
    console.error('[INTERNAL API] getUsersBatch error:', error.message);
    return [];
  }
};

// Fetch Addresses Batch
export const getAddressesBatch = async (ids: string[]): Promise<InternalAddress[]> => {
  if (ids.length === 0) return [];
  try {
    const response = await internalAxios.post(`${AUTH_SERVICE_URL}/api/address/batch`, { ids }, {
      headers: internalHeaders()
    });
    return response.data;
  } catch (error: any) {
    console.error('[INTERNAL API] getAddressesBatch error:', error.message);
    return [];
  }
};

// Fetch Providers Batch
export const getProvidersBatch = async (ids: string[]): Promise<InternalProvider[]> => {
  if (ids.length === 0) return [];
  try {
    const response = await internalAxios.post(`${PROVIDER_SERVICE_URL}/api/providers/batch`, { ids }, {
      headers: internalHeaders()
    });
    return response.data;
  } catch (error: any) {
    console.error('[INTERNAL API] getProvidersBatch error:', error.message);
    return [];
  }
};

// Fetch a single Provider by user_id (internal, no Bearer token needed)
export const getProviderByUserId = async (userId: string): Promise<InternalProvider | null> => {
  try {
    const response = await internalAxios.post(`${PROVIDER_SERVICE_URL}/api/providers/by-user-ids`, { userIds: [userId] }, {
      headers: internalHeaders()
    });
    const providers: InternalProvider[] = response.data;
    return providers.length > 0 ? providers[0] : null;
  } catch (error: any) {
    console.error('[INTERNAL API] getProviderByUserId error:', error.message);
    return null;
  }
};

// Fetch Catalog Batch
export const getCatalogBatch = async (
  subserviceIds: string[] = [],
  serviceIds: string[] = [],
  categoryIds: string[] = [],
  couponIds: string[] = [],
  populateRelated: boolean = false
): Promise<{ subservices: InternalSubService[], services: InternalService[], categories: InternalCategory[], coupons: any[] }> => {
  try {
    const response = await internalAxios.post(`${CATALOG_SERVICE_URL}/api/batch`, {
      subserviceIds, serviceIds, categoryIds, couponIds, populateRelated
    }, {
      headers: internalHeaders()
    });
    return response.data;
  } catch (error: any) {
    console.error('[INTERNAL API] getCatalogBatch error:', error.message);
    return { subservices: [], services: [], categories: [], coupons: [] };
  }
};

// Fetch Active Membership Features
export const getActiveMembershipFeatures = async (userId: string): Promise<any> => {
  try {
    const response = await axios.get(`${PAYMENT_SERVICE_URL}/api/user-memberships/user/${userId}/active`, {
      headers: internalHeaders()
    });
    const activeMembership = response.data;
    if (!activeMembership || !activeMembership.membership_id) return null;

    // Now fetch the actual membership features from catalog-service
    const membershipResponse = await axios.get(`${CATALOG_SERVICE_URL}/api/memberships/${activeMembership.membership_id}`);
    return membershipResponse.data;
  } catch (error: any) {
    // Silently fail if no membership
    return null;
  }
};

// Fetch User Stats
export const getUserStats = async (): Promise<any> => {
  try {
    const response = await axios.get(`${AUTH_SERVICE_URL}/api/users/stats`, {
      headers: internalHeaders()
    });
    return response.data;
  } catch (error: any) {
    console.error('[INTERNAL API] getUserStats error:', error.message);
    return null;
  }
};

// Fetch Provider Stats
export const getProviderStats = async (): Promise<any> => {
  try {
    const response = await axios.get(`${PROVIDER_SERVICE_URL}/api/providers/stats`, {
      headers: internalHeaders()
    });
    return response.data;
  } catch (error: any) {
    console.error('[INTERNAL API] getProviderStats error:', error.message);
    return null;
  }
};

// Notifications
export const sendAdminNotification = async (title: string, message: string, type: string, metadata?: any) => {
  try {
    await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
      recipient_type: 'Admin',
      title,
      message,
      type,
      metadata
    }, {
      headers: internalHeaders()
    });
  } catch (error) {
    console.error('[INTERNAL API] sendAdminNotification failed:', error);
  }
};

export const sendNotification = async (recipientId: string, title: string, message: string, type: string, metadata?: any) => {
  try {
    await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
      recipient_id: recipientId,
      recipient_type: 'User',
      title,
      message,
      type,
      metadata
    }, {
      headers: internalHeaders()
    });
  } catch (error) {
    console.error('[INTERNAL API] sendNotification failed:', error);
  }
};

export const enqueueSmsNotification = async (phone: string, title: string, body: string) => {
  try {
    await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications/enqueue`, {
      type: 'sms',
      recipient: phone,
      title,
      body
    }, {
      headers: internalHeaders()
    });
  } catch (error) {
    console.error('[INTERNAL API] enqueueSmsNotification failed:', error);
  }
};

export const emitSocketEvent = async (userId: string, event: string, data: any): Promise<void> => {
  try {
    await axios.post(`${PROVIDER_SERVICE_URL}/api/internal/emit`, {
      userId,
      event,
      data,
    }, {
      headers: internalHeaders(),
    });
  } catch (error: any) {
    console.error('[INTERNAL API] emitSocketEvent failed:', error.message);
  }
};

export const updateProviderStatusInternal = async (
  providerId: string,
  isBusy?: boolean,
  availability_status?: 'available' | 'busy' | 'offline'
): Promise<void> => {
  try {
    await axios.post(`${PROVIDER_SERVICE_URL}/api/internal/provider/status`, {
      providerId,
      isBusy,
      availability_status,
    }, {
      headers: internalHeaders(),
    });
  } catch (error: any) {
    console.error('[INTERNAL API] updateProviderStatusInternal failed:', error.message);
  }
};

export const cleanupBookingTrackingInternal = async (bookingId: string): Promise<void> => {
  try {
    await axios.post(`${PROVIDER_SERVICE_URL}/api/internal/booking/cleanup-tracking`, {
      booking_id: bookingId,
    }, {
      headers: internalHeaders(),
    });
  } catch (error: any) {
    console.error('[INTERNAL API] cleanupBookingTrackingInternal failed:', error.message);
  }
};

export const linkPaymentInternal = async (payload: {
  payment_id?: string;
  booking_id?: string;
  order_id?: string;
  user_id?: string;
  amount?: number;
  payment_method?: string;
  payment_provider?: string;
  payment_channel?: string;
  transaction_id?: string;
  correlation_id?: string;
  payment_attempt_id?: string;
}, retries = 3): Promise<any> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data } = await internalAxios.post(`${PAYMENT_SERVICE_URL}/api/payments/internal/link`, payload, {
        headers: internalHeaders(),
        timeout: 5000,
      });
      return data?.payment || null;
    } catch (error: any) {
      console.error(`[INTERNAL API] linkPaymentInternal attempt ${attempt}/${retries} failed:`, error.message);
      if (attempt === retries) return null;
      await new Promise((res) => setTimeout(res, attempt * 300));
    }
  }
  return null;
};

// Expire all pending job requests for given booking IDs (called on high demand timeout)
export const expireJobRequestsForBookings = async (bookingIds: string[]): Promise<void> => {
  if (bookingIds.length === 0) return;
  try {
    await internalAxios.post(`${PROVIDER_SERVICE_URL}/api/internal/job-requests/expire-batch`, {
      bookingIds
    }, {
      headers: internalHeaders()
    });
  } catch (error: any) {
    console.error('[INTERNAL API] expireJobRequestsForBookings failed:', error.message);
  }
};

export const triggerRefundEvaluationInternal = async (
  bookingId: string,
  reason: string,
  idempotencyKey?: string
): Promise<any> => {
  const REFUND_SERVICE_URL = process.env.REFUND_SERVICE_URL || 'http://127.0.0.1:5007';
  const key = idempotencyKey || `${bookingId}:${reason}`;
  try {
    const { data } = await internalAxios.post(
      `${REFUND_SERVICE_URL}/api/refunds/internal/evaluate`,
      { booking_id: bookingId, reason },
      {
        headers: {
          ...internalHeaders(),
          'x-idempotency-key': key
        }
      }
    );
    return data;
  } catch (error: any) {
    console.error('[INTERNAL API] triggerRefundEvaluationInternal failed:', error.message);
    return null;
  }
};

// Search Users by Keyword (for admin search across bookings by customer or provider name)
export const searchUserIdsByKeyword = async (keyword: string): Promise<string[]> => {
  if (!keyword || !keyword.trim()) return [];
  try {
    const response = await internalAxios.post(`${AUTH_SERVICE_URL}/api/users/internal/search`, { keyword }, {
      headers: internalHeaders()
    });
    const users = Array.isArray(response.data) ? response.data : [];
    return users.map((u: any) => String(u._id));
  } catch (error: any) {
    console.error('[INTERNAL API] searchUserIdsByKeyword error:', error.message);
    return [];
  }
};

// Search Providers by Keyword and/or User IDs
export const searchProviderIdsByKeyword = async (userIds: string[], keyword: string): Promise<{ providerIds: string[], userIds: string[] }> => {
  try {
    const response = await internalAxios.post(`${PROVIDER_SERVICE_URL}/api/providers/internal/search`, { keyword, userIds }, {
      headers: internalHeaders()
    });
    const providers = Array.isArray(response.data) ? response.data : [];
    const pIds: string[] = [];
    const pUserIds: string[] = [];

    providers.forEach((p: any) => {
      const idStr = String(p._id);
      const uIdStr = String(p.user_id?._id || p.user_id);
      if (idStr && !pIds.includes(idStr)) pIds.push(idStr);
      if (uIdStr && !pUserIds.includes(uIdStr)) pUserIds.push(uIdStr);
    });

    return { providerIds: pIds, userIds: pUserIds };
  } catch (error: any) {
    console.error('[INTERNAL API] searchProviderIdsByKeyword error:', error.message);
    return { providerIds: [], userIds: [] };
  }
};
