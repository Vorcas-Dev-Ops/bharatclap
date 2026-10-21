import axios from 'axios';
import { handleAuthenticationFailure, getIsLoggingOut } from '@/utils/auth';

// Check if we are in a browser environment
const isBrowser = typeof window !== "undefined";

declare module 'axios' {
  export interface AxiosRequestConfig {
    silent?: boolean;
  }
}

// Use 127.0.0.1 instead of localhost for better Windows compatibility
const DEFAULT_URL = "http://127.0.0.1:5000";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_URL;
export const API_URL = isBrowser
  ? (process.env.NEXT_PUBLIC_API_URL || '/api')
  : (process.env.API_GATEWAY_INTERNAL_URL ? `${process.env.API_GATEWAY_INTERNAL_URL}/api` : `${BACKEND_URL}/api`);

// Shared axios instance with sensible defaults (15s request timeout)
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-attach JWT token from localStorage to every request
apiClient.interceptors.request.use((config) => {
  if (isBrowser) {
    if (getIsLoggingOut()) {
      return config;
    }
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

import { normalizeApiError } from '@/utils/errorNormalizer';

// Handle global API response errors (401, 403, 408, 500, 503)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    // Transient service startup/restart retry (502/503/504 on idempotent GET requests)
    if (
      config &&
      (!config._retryCount || config._retryCount < 2) &&
      [502, 503, 504].includes(error.response?.status) &&
      config.method?.toLowerCase() === 'get'
    ) {
      config._retryCount = (config._retryCount || 0) + 1;
      const delayMs = config._retryCount * 800;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return apiClient(config);
    }

    const normalized = normalizeApiError(error);
    if (error) {
      error.normalized = normalized;
      error.userMessage = normalized.userMessage;
    }

    if (isBrowser) {
      const status = error.response?.status;
      const message: string = error.response?.data?.message || '';

      if (status === 401) {
        console.warn('[API 401 UNAUTHORIZED]', normalized.userMessage);
      } else if (status === 403) {
        console.warn('[API 403 FORBIDDEN]', normalized.userMessage);
      } else if (status === 503) {
        console.warn('[API 503 SERVICE UNAVAILABLE]', normalized.userMessage);
      }
    }
    return Promise.reject(error);
  }
);
