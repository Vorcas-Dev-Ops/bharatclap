import axios from 'axios';
import { handleAuthenticationFailure } from '@/utils/auth';

// Check if we are in a browser environment
const isBrowser = typeof window !== "undefined";

// Use 127.0.0.1 instead of localhost for better Windows compatibility
const DEFAULT_URL = "http://127.0.0.1:5000";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_URL;
export const API_URL = process.env.NEXT_PUBLIC_API_URL || `${BACKEND_URL}/api`;

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
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle global API response errors (401, 403, 408, 500, 503)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isBrowser) {
      const status = error.response?.status;
      const message: string = error.response?.data?.message || '';

      if (status === 401) {
        const token = localStorage.getItem('token');
        const isTokenExpired = !token || message.includes('expired') || message.includes('no token') || message.includes('invalid');
        if (isTokenExpired) {
          const currentPath = window.location.pathname;
          const returnUrl = currentPath && currentPath !== '/login' ? `?returnUrl=${encodeURIComponent(currentPath)}` : '';
          handleAuthenticationFailure(message || 'Session expired');
          if (returnUrl) {
            window.location.href = `/login${returnUrl}`;
          }
        }
      } else if (status === 403) {
        console.warn('[API 403 FORBIDDEN]', message);
      } else if (status === 503) {
        console.warn('[API 503 SERVICE UNAVAILABLE] Backend service is starting up or under maintenance.');
      }
    }
    return Promise.reject(error);
  }
);
