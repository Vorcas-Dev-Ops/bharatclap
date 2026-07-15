"use client";

import { useEffect } from 'react';
import axios from 'axios';
import { API_URL, apiClient } from '@/config/api';

// Queue logic outside the component to persist across re-renders
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
    // Configure default settings
    axios.defaults.withCredentials = true;

    // Shared error handler logic for both axios and apiClient
    const handleAuthError = async (error: any, instance: any) => {
      const originalRequest = error.config;
      const isRefreshCall = originalRequest?.url?.includes('/users/refresh');
      const token = localStorage.getItem('token');

      if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall && token) {
        if (isRefreshing) {
          // If already refreshing, queue this request
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

        try {
          const response = await axios.post(`${API_URL}/users/refresh`, {}, { withCredentials: true });
          const newToken = response.data.token;
          
          if (newToken) {
            localStorage.setItem('token', newToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            
            processQueue(null, newToken);
            return instance(originalRequest);
          }
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          document.cookie = 'token=; Max-Age=0; path=/';
          document.cookie = 'userRole=; Max-Age=0; path=/';
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
      return Promise.reject(error);
    };

    // Add interceptor to global axios
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => handleAuthError(error, axios)
    );

    // Add identical interceptor to apiClient
    const apiInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => handleAuthError(error, apiClient)
    );

    // Set authorization header if token exists in localStorage
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
