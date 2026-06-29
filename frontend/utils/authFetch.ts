"use client";
/**
 * authFetch — a drop-in replacement for fetch() that:
 * 1. Always attaches the latest token from localStorage
 * 2. On 401, attempts a token refresh via /api/users/refresh (using the httpOnly jwt cookie)
 * 3. Concurrent 401s share ONE refresh request (no race condition / cookie invalidation)
 * 4. If refresh succeeds, retries the original request once with the new token
 * 5. If refresh fails, clears auth state and redirects to /login
 */

import { API_URL } from '@/config/api';

const getToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem('token') : null;

// ── Singleton refresh promise ─────────────────────────────────────────────────
// When multiple requests get a 401 simultaneously, only ONE refresh is issued.
// All callers await the same promise so the refresh cookie is only consumed once.
let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  // If a refresh is already in-flight, reuse it
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_URL}/users/refresh`, {
        method: 'POST',
        credentials: 'include', // sends the httpOnly "jwt" refresh cookie
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        return data.token;
      }
      return null;
    } catch {
      return null;
    } finally {
      // Clear the singleton so future 401s can trigger a fresh refresh
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function forceLogout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

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

  // If not 401 — return as-is
  if (res.status !== 401) return res;

  // ── 401: attempt token refresh (deduped) ───────────────────────────────────
  const newToken = await tryRefresh();

  if (!newToken) {
    forceLogout();
    return res; // return original 401 response
  }

  // Retry original request with fresh token
  headers['Authorization'] = `Bearer ${newToken}`;
  res = await fetch(input, { ...init, headers, credentials: 'include' });

  // If the retry still 401s (e.g. token rotation invalidated the session),
  // force logout rather than looping again.
  if (res.status === 401) {
    forceLogout();
  }

  return res;
}
