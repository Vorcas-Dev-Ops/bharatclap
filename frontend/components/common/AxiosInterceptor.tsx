"use client";

import { useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/api';

export default function AxiosInterceptor() {
  useEffect(() => {
    // Configure default settings
    axios.defaults.withCredentials = true;

    // Add a response interceptor
    const interceptor = axios.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // If the error is 401 and we haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Attempt to refresh the token
            const response = await axios.post(`${API_URL}/users/refresh`, {}, {
              withCredentials: true
            });

            const newToken = response.data.token;
            
            if (newToken) {
              // Store new token (update localStorage to match existing app logic)
              localStorage.setItem('token', newToken);

              // Update the failed request with the new token
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              
              // Also update default headers so subsequent requests use the new token
              axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

              // Retry the original request
              return axios(originalRequest);
            }
          } catch (refreshError) {
            // If refresh fails, log out the user
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
    };
  }, []);

  return null;
}
