import axios from 'axios';

const internalClient = axios.create({
  timeout: 10000,
});

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:5006';

/**
 * Returns the x-internal-service-key header for service-to-service calls.
 * All internal/batch endpoints require this header for authentication.
 */

const DEFAULT_INTERNAL_KEY = '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

const internalHeaders = () => {
  const key = process.env.INTERNAL_SERVICE_KEY || DEFAULT_INTERNAL_KEY;
  return { 'x-internal-service-key': key };
};

// Users
class SimpleLRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private max: number = 1000) {}
  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (item !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }
}

const batchUserCache = new SimpleLRUCache<string, { data: any, expires: number }>(500);

export const getUsersBatch = async (rawIds: any[]) => {
  if (!rawIds || !rawIds.length) return [];
  const ids = Array.from(new Set(rawIds.map((id: any) => {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (id._id) return String(id._id);
    if (id.id) return String(id.id);
    return String(id);
  }).filter((s: string) => s && s !== '[object Object]')));

  if (!ids.length) return [];
  
  const cacheKey = [...ids].sort().join(',');
  const now = Date.now();
  const cached = batchUserCache.get(cacheKey);
  if (cached && cached.expires > now && Array.isArray(cached.data) && cached.data.length > 0) {
    return cached.data;
  }

  try {
    const { data } = await internalClient.post(`${AUTH_SERVICE_URL}/api/users/batch`, { ids }, {
      headers: internalHeaders()
    });
    const result = Array.isArray(data) ? data : [];
    if (result.length > 0) {
      batchUserCache.set(cacheKey, { data: result, expires: now + 5 * 60 * 1000 }); // 5 min TTL
    }
    return result;
  } catch (error) {
    console.error('[INTERNAL API] getUsersBatch failed:', error);
    return [];
  }
};

const userCache = new SimpleLRUCache<string, { data: any, expires: number }>(1000);

export const getUserById = async (id: string, token: string) => {
  const now = Date.now();
  const cached = userCache.get(id);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  try {
    const { data } = await internalClient.get(`${AUTH_SERVICE_URL}/api/users/${id}`, {
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
    const { data } = await internalClient.post(`${AUTH_SERVICE_URL}/api/address/batch`, { ids }, {
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
    const { data } = await internalClient.post(`${AUTH_SERVICE_URL}/api/locations/batch`, { ids }, {
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
    const { data } = await internalClient.get(`${AUTH_SERVICE_URL}/api/locations`);
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
    const { data } = await internalClient.post(`${CATALOG_SERVICE_URL}/api/batch`, {
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
    const { data } = await internalClient.post(`${BOOKING_SERVICE_URL}/api/bookings/batch`, { ids }, {
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
    await internalClient.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
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

export const sendProviderNotification = async (recipient_id: string, title: string, message: string, type: string, metadata?: any) => {
  try {
    await internalClient.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
      recipient_id,
      recipient_type: 'Provider',
      title,
      message,
      type,
      metadata
    }, {
      headers: internalHeaders()
    });
  } catch (error) {
    console.error('[INTERNAL API] sendProviderNotification failed:', error);
  }
};

export const checkActiveBookingByProvider = async (providerId: string): Promise<boolean> => {
  try {
    const { data } = await internalClient.get(`${BOOKING_SERVICE_URL}/api/bookings/internal/active-booking/${providerId}`, {
      headers: internalHeaders()
    });
    return !!data?.hasActiveBooking;
  } catch (error) {
    console.error('[INTERNAL API] checkActiveBookingByProvider failed:', error);
    return false;
  }
};
