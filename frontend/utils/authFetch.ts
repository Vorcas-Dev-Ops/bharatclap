"use client";
/**
 * authFetch — a drop-in replacement for fetch() that:
 * 1. Always attaches the latest token from localStorage
 * 2. On 401, attempts a token refresh via /api/users/refresh (using the httpOnly jwt cookie)
 * 3. If refresh succeeds, retries the original request once with the new token
 * 4. If refresh fails, redirects to /login
 */

import { API_URL } from '@/config/api';

const getToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem('token') : null;

async function tryRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/users/refresh`, {
      method: 'POST',
      credentials: 'include', // sends the httpOnly "jwt" refresh cookie
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
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

  const res = await fetch(input, { ...init, headers });

  // If not 401 — return as-is
  if (res.status !== 401) return res;

  // Try to refresh the access token
  const newToken = await tryRefresh();

  if (!newToken) {
    // Refresh failed — force re-login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return res; // return original 401 response
  }

  // Retry with fresh token
  headers['Authorization'] = `Bearer ${newToken}`;
  return fetch(input, { ...init, headers });
}
