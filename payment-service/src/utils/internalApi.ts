import axios from 'axios';
axios.defaults.timeout = 5000; // 5s timeout for internal calls

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
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

// Users
export const getUsersBatch = async (ids: string[]) => {
  if (!ids.length) return [];
  try {
    const { data } = await axios.post(`${AUTH_SERVICE_URL}/api/users/batch`, { ids }, {
      headers: internalHeaders()
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[INTERNAL API] getUsersBatch failed:', error);
    return [];
  }
};

export const getUserById = async (id: string, token: string) => {
  try {
    const { data } = await axios.get(`${AUTH_SERVICE_URL}/api/users/${id}`, {
      headers: { Authorization: token }
    });
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
    const { data } = await axios.post(`${AUTH_SERVICE_URL}/api/address/batch`, { ids }, {
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

// Bookings & Cart
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


export const getUserCartInternal = async (userId: string) => {
  try {
    const { data } = await axios.get(`${BOOKING_SERVICE_URL}/api/cart/internal/user-cart/${userId}`, {
      headers: internalHeaders()
    });
    return data;
  } catch (error) {
    console.error(`[INTERNAL API] getUserCartInternal for ${userId} failed:`, error);
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

const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';

export const getProvidersBatch = async (ids: string[]) => {
  if (!ids.length) return [];
  try {
    const { data } = await axios.post(`${PROVIDER_SERVICE_URL}/api/providers/batch`, { ids }, {
      headers: internalHeaders()
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[INTERNAL API] getProvidersBatch failed:', error);
    return [];
  }
};
