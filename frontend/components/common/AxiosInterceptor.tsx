"use client";

import { useEffect } from 'react';
import axios from 'axios';
import { API_URL, apiClient } from '@/config/api';
import { handleAuthenticationFailure, authLog, getIsLoggingOut, setAuthState } from '@/utils/auth';

// Shared queue logic for concurrent request refresh deduplication
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export default function AxiosInterceptor() {
  useEffect(() => {
    axios.defaults.withCredentials = true;

    const handleAuthError = async (error: any, instance: any) => {
      const originalRequest = error.config;
      const isRefreshCall = originalRequest?.url?.includes('/users/refresh');
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      if (getIsLoggingOut()) {
        return Promise.reject(error);
      }

      // If a retried request gets a 401 again, session is completely dead -> log out immediately
      if (error.response?.status === 401 && originalRequest?._retry) {
        authLog('Retried request failed with 401: session invalidated');
        handleAuthenticationFailure('Retried request failed with 401');
        return Promise.reject(error);
      }

      if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall && token) {
        if (getIsLoggingOut()) {
          return Promise.reject(error);
        }

        if (isRefreshing) {
          try {
            const newToken = await new Promise<string>((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            });
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return instance(originalRequest);
          } catch (err) {
            return Promise.reject(err);
          }
        }

        originalRequest._retry = true;
        isRefreshing = true;

        authLog('Axios 401 encountered, attempting refresh...');

        try {
          const response = await axios.post(`${API_URL}/users/refresh`, {}, { withCredentials: true });
          const newToken = response.data?.token || response.data?.accessToken;
          
          if (newToken) {
            if (getIsLoggingOut()) {
              return Promise.reject(new Error('Logout in progress'));
            }
            authLog('Axios refresh token succeeded');
            setAuthState(newToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            
            processQueue(null, newToken);
            return instance(originalRequest);
          } else {
            const noTokenErr = new Error('No token returned from refresh endpoint');
            authLog('Axios refresh returned no token');
            processQueue(noTokenErr, null);
            handleAuthenticationFailure('Axios token refresh returned no token');
            return Promise.reject(noTokenErr);
          }
        } catch (refreshError) {
          authLog('Axios refresh token failed');
          processQueue(refreshError, null);
          handleAuthenticationFailure('Axios token refresh failed');
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
      return Promise.reject(error);
    };

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => handleAuthError(error, axios)
    );

    const apiInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => handleAuthError(error, apiClient)
    );

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    return () => {
      axios.interceptors.response.eject(interceptor);
      apiClient.interceptors.response.eject(apiInterceptor);
    };
  }, []);

  return null;
}
