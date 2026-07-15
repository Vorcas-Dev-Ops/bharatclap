import axios from 'axios';

// Check if we are in a browser environment
const isBrowser = typeof window !== "undefined";

// Use 127.0.0.1 instead of localhost for better Windows compatibility
const DEFAULT_URL = "http://127.0.0.1:5000";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_URL;
export const API_URL = process.env.NEXT_PUBLIC_API_URL || `${BACKEND_URL}/api`;

// Shared axios instance with sensible defaults to prevent 408 timeout errors
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30-second timeout (remote MongoDB can be slow)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-attach JWT token from localStorage to every request
apiClient.interceptors.request.use((config) => {
  if (isBrowser) {
    const token = localStorage.getItem('token') || localStorage.getItem('jwt');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 Unauthorized responses globally.
// Only redirect to login when the token is actually gone or the server
// explicitly says it is expired/invalid. Do NOT clear session on every 401
// because data-fetching endpoints can return 401 for authorization errors
// (e.g. wrong role) that shouldn't blow away a valid session.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && isBrowser) {
      const token = localStorage.getItem('token') || localStorage.getItem('jwt');
      const message: string = error.response?.data?.message || '';
      const isTokenGone = !token;
      const isTokenExpired = message.includes('expired') || message.includes('no token');
      // Only force logout when the token itself is bad/gone.
      // 'Not authorized, token failed' from a data endpoint should NOT log out.
      if (isTokenGone || isTokenExpired) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('jwt');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
