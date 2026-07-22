"use client";
/**
 * authFetch — drop-in replacement for fetch() that:
 * 1. Attaches token from localStorage to Authorization header
 * 2. On 401, attempts a deduplicated token refresh via /api/users/refresh
 * 3. On refresh success, retries original request once
 * 4. On refresh failure, delegates to central handleAuthenticationFailure()
 */

import { API_URL } from '@/config/api';
import { handleAuthenticationFailure, authLog, getIsLoggingOut } from '@/utils/auth';

const getToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem('token') : null;

// Singleton refresh promise to deduplicate concurrent refresh requests
let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (getIsLoggingOut()) {
    authLog('Logout in progress, skipping token refresh attempt');
    return null;
  }

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<string | null> => {
    authLog('Attempting token refresh via /api/users/refresh...');
    try {
      const res = await fetch(`${API_URL}/users/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        authLog('Token refresh endpoint responded with status:', res.status);
        return null;
      }

      const data = await res.json();
      if (data.token) {
        authLog('Token refresh successful');
        localStorage.setItem('token', data.token);
        return data.token;
      }
      return null;
    } catch (err: any) {
      authLog('Token refresh request error:', err?.message);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function authFetch(
  input: RequestInfo,
  init: RequestInit = {}
): Promise<Response> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(input, { ...init, headers, credentials: 'include' });

  if (res.status !== 401) return res;

  // Prevent recursive refresh loops if the refresh call itself is the one failing
  const requestUrl = typeof input === 'string' ? input : (input as Request).url;
  if (requestUrl.includes('/users/refresh')) {
    return res;
  }

  authLog('Received 401 for request:', requestUrl, 'Attempting token refresh...');
  const newToken = await tryRefresh();

  if (!newToken) {
    handleAuthenticationFailure('Token refresh failed');
    return res;
  }

  // Retry original request with fresh token
  headers['Authorization'] = `Bearer ${newToken}`;
  res = await fetch(input, { ...init, headers, credentials: 'include' });

  if (res.status === 401) {
    handleAuthenticationFailure('Retried request still unauthorized');
  }

  return res;
}
