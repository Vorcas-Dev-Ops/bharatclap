import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:5002';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:5004';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5006';

/**
 * Returns the x-internal-service-key header for service-to-service calls.
 * All internal/batch endpoints require this header for authentication.
 */
const internalHeaders = () => {
  const key = process.env.INTERNAL_SERVICE_KEY;
  if (!key) {
    throw new Error('[INTERNAL API] INTERNAL_SERVICE_KEY is not set — cannot make internal service calls');
  }
  return { 'x-internal-service-key': key };
};

// Users
const batchUserCache = new Map<string, { data: any, expires: number }>();

export const getUsersBatch = async (ids: string[]) => {
  if (!ids.length) return [];
  
  const cacheKey = ids.sort().join(',');
  const now = Date.now();
  const cached = batchUserCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  try {
    const { data } = await axios.post(`${AUTH_SERVICE_URL}/api/users/batch`, { ids }, {
      headers: internalHeaders()
    });
    const result = Array.isArray(data) ? data : [];
    batchUserCache.set(cacheKey, { data: result, expires: now + 5 * 60 * 1000 }); // 5 min TTL
    return result;
  } catch (error) {
    console.error('[INTERNAL API] getUsersBatch failed:', error);
    return [];
  }
};

const userCache = new Map<string, { data: any, expires: number }>();

export const getUserById = async (id: string, token: string) => {
  const now = Date.now();
  const cached = userCache.get(id);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  try {
    const { data } = await axios.get(`${AUTH_SERVICE_URL}/api/users/${id}`, {
      headers: { Authorization: token }
    });
    userCache.set(id, { data, expires: now + 5 * 60 * 1000 }); // 5 min TTL
    return data;
  } catch (error) {
    console.error(`[INTERNAL API] getUserById ${id} failed:`, error);
    return null;
  }
};

// Addresses
export const getAddressesBatch = async (ids: string[]) => {
  if (!ids.length) return [];
  try {
    const { data } = await axios.post(`${AUTH_SERVICE_URL}/api/addresses/batch`, { ids }, {
      headers: internalHeaders()
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[INTERNAL API] getAddressesBatch failed:', error);
    return [];
  }
};

// Locations
export const getLocationsBatch = async (ids: string[]) => {
  if (!ids.length) return [];
  try {
    const { data } = await axios.post(`${AUTH_SERVICE_URL}/api/locations/batch`, { ids }, {
      headers: internalHeaders()
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[INTERNAL API] getLocationsBatch failed:', error);
    return [];
  }
};

export const getAllLocations = async () => {
  try {
    const { data } = await axios.get(`${AUTH_SERVICE_URL}/api/locations`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[INTERNAL API] getAllLocations failed:', error);
    return [];
  }
};

// Catalog (SubServices, Services)
export const getCatalogBatch = async (
  subserviceIds: string[] = [],
  serviceIds: string[] = [],
  categoryIds: string[] = [],
  couponIds: string[] = []
) => {
  const hasIds = subserviceIds.length || serviceIds.length || categoryIds.length || couponIds.length;
  if (!hasIds) return { subservices: [], services: [], categories: [], coupons: [] };

  try {
    const { data } = await axios.post(`${CATALOG_SERVICE_URL}/api/batch`, {
      subserviceIds, serviceIds, categoryIds, couponIds
    }, {
      headers: internalHeaders()
    });
    return data;
  } catch (error) {
    console.error('[INTERNAL API] getCatalogBatch failed:', error);
    return { subservices: [], services: [], categories: [], coupons: [] };
  }
};

// Bookings
export const getBookingsBatch = async (ids: string[]) => {
  if (!ids.length) return [];
  try {
    const { data } = await axios.post(`${BOOKING_SERVICE_URL}/api/bookings/batch`, { ids }, {
      headers: internalHeaders()
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[INTERNAL API] getBookingsBatch failed:', error);
    return [];
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
