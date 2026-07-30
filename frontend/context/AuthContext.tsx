"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';
import Cookies from 'js-cookie';
import {
  AuthStatus,
  authLog,
  authChannel,
  clearAuthState,
  setAuthState,
  handleAuthenticationFailure
} from '@/utils/auth';

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  role: string;
  admin_role?: 'super_admin' | 'operations_admin' | 'finance_admin' | 'support_admin';
  permissions?: string[];
  profile_image?: string;
  status?: string;
}

interface AuthContextType {
  status: AuthStatus;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReconnecting: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginSuccess: (token: string, userData: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('AUTH_LOADING');
  const [user, setUser] = useState<UserProfile | null>(null);
  const fetchingRef = useRef(false);

  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const userRef = useRef<UserProfile | null>(null);
  const renderCountRef = useRef(0);
  const instanceIdRef = useRef(Math.floor(1000 + Math.random() * 9000));

  renderCountRef.current += 1;
  authLog(`[AuthProvider] Render #${renderCountRef.current} (Instance #${instanceIdRef.current}), status: ${status}`);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      authLog('Clearing backend reconnect retry timer.');
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // ponytail: Distinguish between 401/403 (invalid token -> clear auth) vs network/5xx (backend down -> preserve session & retry in background)
  const fetchCurrentUser = useCallback(async (): Promise<boolean> => {
    if (fetchingRef.current) {
      authLog('fetchCurrentUser already in flight, skipping duplicate call');
      return false;
    }

    // Dev-only configuration flag for forced fresh sessions
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FORCE_FRESH_DEV_SESSION === 'true') {
      authLog('NEXT_PUBLIC_FORCE_FRESH_DEV_SESSION enabled. Clearing session for fresh dev state.');
      clearAuthState();
      setUser(null);
      setStatus('UNAUTHENTICATED');
      clearRetryTimer();
      return false;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    if (!token) {
      authLog('No token found during initialization');
      setUser(null);
      setStatus('UNAUTHENTICATED');
      clearRetryTimer();
      return false;
    }

    fetchingRef.current = true;
    setStatus((prev) => (prev === 'AUTHENTICATED' ? 'AUTHENTICATED' : prev === 'AUTH_RECONNECTING' ? 'AUTH_RECONNECTING' : 'AUTH_LOADING'));
    authLog('Checking session with GET /api/users/me...');

    try {
      const res = await authFetch(`${API_URL}/users/me`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (res.ok) {
        const userData: UserProfile = await res.json();
        authLog('Session restored for user:', userData.name, 'role:', userData.role);
        setUser(userData);
        setStatus('AUTHENTICATED');
        if (userData.role) {
          Cookies.set('userRole', userData.role, { expires: 7, path: '/' });
        }
        clearRetryTimer();
        return true;
      } else if (res.status === 401 || res.status === 403) {
        authLog('GET /api/users/me returned auth failure status:', res.status);
        clearRetryTimer();
        handleAuthenticationFailure(`Server returned ${res.status}`);
        setUser(null);
        setStatus('UNAUTHENTICATED');
        return false;
      } else {
        authLog('GET /api/users/me server error (5xx or non-401):', res.status);
        // Do NOT wipe auth storage on 5xx server errors; preserve session & set AUTH_RECONNECTING
        setStatus((prev) => (userRef.current ? 'AUTHENTICATED' : 'AUTH_RECONNECTING'));
        scheduleBackendRetry();
        return false;
      }
    } catch (err: any) {
      authLog('Network exception fetching /api/users/me:', err?.message);
      // Network failure (offline/gateway timeout) -> preserve session & set AUTH_RECONNECTING
      setStatus((prev) => (userRef.current ? 'AUTHENTICATED' : 'AUTH_RECONNECTING'));
      scheduleBackendRetry();
      return false;
    } finally {
      fetchingRef.current = false;
    }
  }, [clearRetryTimer]);

  const scheduleBackendRetry = useCallback(() => {
    if (retryTimerRef.current) {
      authLog('Backend reconnect timer is already running. Guarding against duplicate interval.');
      return;
    }
    authLog('Scheduling periodic backend reconnect check every 5s...');
    retryTimerRef.current = setInterval(() => {
      authLog('Retrying session restoration with backend...');
      fetchCurrentUser();
    }, 5000);
  }, [fetchCurrentUser]);

  // Single initialization on mount
  useEffect(() => {
    authLog(`[AuthProvider] Mounted instance #${instanceIdRef.current}`);
    authLog('Initializing authentication context (executes once on mount)...');
    fetchCurrentUser();

    // Cross-tab BroadcastChannel listener
    const handleBroadcastMessage = (event: MessageEvent) => {
      authLog('BroadcastChannel message received:', event.data);
      if (event.data?.type === 'LOGOUT') {
        setUser(null);
        setStatus('UNAUTHENTICATED');
        clearRetryTimer();
      } else if (event.data?.type === 'LOGIN') {
        fetchCurrentUser();
      }
    };

    if (authChannel) {
      authChannel.onmessage = handleBroadcastMessage;
    }

    // Window storage events listener (other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (!e.newValue) {
          setUser(null);
          setStatus('UNAUTHENTICATED');
          clearRetryTimer();
        } else {
          fetchCurrentUser();
        }
      }
    };

    const handleAuthLogoutEvent = () => {
      setUser(null);
      setStatus('UNAUTHENTICATED');
      clearRetryTimer();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    };

    // BFCache (Back-Forward Cache) Protection: Re-validate auth state on Back/Forward navigation
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        authLog('Restored from BFCache (Back/Forward navigation). Re-verifying session...');
        fetchCurrentUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-logout', handleAuthLogoutEvent);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      authLog(`[AuthProvider] Unmounted instance #${instanceIdRef.current}`);
      clearRetryTimer();
      if (authChannel) {
        authChannel.onmessage = null;
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-logout', handleAuthLogoutEvent);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [fetchCurrentUser, clearRetryTimer]);

  // Logout handler
  const logout = async (): Promise<void> => {
    authLog('Logout requested');
    try {
      await authFetch(`${API_URL}/users/logout`, { method: 'POST' });
    } catch (e) {
      authLog('Backend logout request failed:', e);
    } finally {
      clearRetryTimer();
      clearAuthState();
      setUser(null);
      setStatus('UNAUTHENTICATED');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
  };

  // Called when login form succeeds
  const loginSuccess = (token: string, userData: any) => {
    authLog('Login success event handled');
    const role = userData?.role || userData?.user?.role;
    setAuthState(token, role);
    // ponytail: Optimistically hydrate auth state from login payload so layout route guards don't race against background /api/users/me fetch.
    const userObj = userData?.user || (userData?._id ? userData : null);
    if (userObj && userObj._id) {
      setUser(userObj);
      setStatus('AUTHENTICATED');
      if (role) {
        Cookies.set('userRole', role, { expires: 7, path: '/' });
      }
    } else {
      setStatus('AUTH_LOADING');
    }
    clearRetryTimer();
    fetchingRef.current = false;
    fetchCurrentUser();
  };

  const refreshUser = async (): Promise<void> => {
    await fetchCurrentUser();
  };

  const value: AuthContextType = {
    status,
    user,
    isAuthenticated: status === 'AUTHENTICATED',
    isLoading: status === 'AUTH_LOADING',
    isReconnecting: status === 'AUTH_RECONNECTING',
    logout,
    refreshUser,
    loginSuccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
