import axios from 'axios';
import { handleAuthenticationFailure } from '@/utils/auth';

// Check if we are in a browser environment
const isBrowser = typeof window !== "undefined";

// Use 127.0.0.1 instead of localhost for better Windows compatibility
const DEFAULT_URL = "http://127.0.0.1:5000";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_URL;
export const API_URL = process.env.NEXT_PUBLIC_API_URL || `${BACKEND_URL}/api`;

// Shared axios instance with sensible defaults
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
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

// Handle 401 Unauthorized responses globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && isBrowser) {
      const token = localStorage.getItem('token');
      const message: string = error.response?.data?.message || '';
      const isTokenGone = !token;
      const isTokenExpired = message.includes('expired') || message.includes('no token') || message.includes('invalid');
      
      if (isTokenGone || isTokenExpired) {
        handleAuthenticationFailure(message || 'Unauthorized API response');
      }
    }
    return Promise.reject(error);
  }
);
