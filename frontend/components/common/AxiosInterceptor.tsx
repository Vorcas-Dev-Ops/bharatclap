"use client";

import { useEffect } from 'react';
import axios from 'axios';
import { API_URL, apiClient } from '@/config/api';

export default function AxiosInterceptor() {
  useEffect(() => {
    // Configure default settings
    axios.defaults.withCredentials = true;

    // Add a response interceptor to global axios
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const response = await axios.post(`${API_URL}/users/refresh`, {}, { withCredentials: true });
            const newToken = response.data.token;
            if (newToken) {
              localStorage.setItem('token', newToken);
              if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${newToken}`;
              axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );

    // Add identical response interceptor to apiClient
    const apiInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const response = await axios.post(`${API_URL}/users/refresh`, {}, { withCredentials: true });
            const newToken = response.data.token;
            if (newToken) {
              localStorage.setItem('token', newToken);
              if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return apiClient(originalRequest);
            }
          } catch (refreshError) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
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
