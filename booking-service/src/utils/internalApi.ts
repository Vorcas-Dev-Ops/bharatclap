import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:5002';
const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5005';

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
    const response = await axios.post(`${AUTH_SERVICE_URL}/api/users/batch`, { ids }, {
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
    const response = await axios.post(`${AUTH_SERVICE_URL}/api/address/batch`, { ids }, {
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
    const response = await axios.post(`${PROVIDER_SERVICE_URL}/api/providers/batch`, { ids }, {
      headers: internalHeaders()
    });
    return response.data;
  } catch (error: any) {
    console.error('[INTERNAL API] getProvidersBatch error:', error.message);
    return [];
  }
};

// Fetch Catalog Batch
export const getCatalogBatch = async (
  subserviceIds: string[] = [],
  serviceIds: string[] = [],
  categoryIds: string[] = [],
  couponIds: string[] = []
): Promise<{ subservices: InternalSubService[], services: InternalService[], categories: InternalCategory[], coupons: any[] }> => {
  try {
    const response = await axios.post(`${CATALOG_SERVICE_URL}/api/batch`, {
      subserviceIds, serviceIds, categoryIds, couponIds
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
