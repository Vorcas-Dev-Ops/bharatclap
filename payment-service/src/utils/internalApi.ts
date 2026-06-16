import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:5002';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:5004';

// Users
export const getUsersBatch = async (ids: string[]) => {
  if (!ids.length) return [];
  try {
    const { data } = await axios.post(`${AUTH_SERVICE_URL}/api/users/batch`, { ids });
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
    const { data } = await axios.post(`${AUTH_SERVICE_URL}/api/addresses/batch`, { ids });
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
    const { data } = await axios.post(`${AUTH_SERVICE_URL}/api/locations/batch`, { ids });
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
    const { data } = await axios.post(`${BOOKING_SERVICE_URL}/api/bookings/batch`, { ids });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[INTERNAL API] getBookingsBatch failed:', error);
    return [];
  }
};
