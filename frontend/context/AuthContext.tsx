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
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginSuccess: (token: string, userData: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('AUTH_LOADING');
  const [user, setUser] = useState<UserProfile | null>(null);
  const fetchingRef = useRef(false);

  authLog('AuthProvider rendered, current status:', status);

  // Fetch current authenticated user profile from single source of truth: /api/users/me
  const fetchCurrentUser = useCallback(async (): Promise<boolean> => {
    if (fetchingRef.current) {
      authLog('fetchCurrentUser already in flight, skipping duplicate call');
      return false;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    if (!token) {
      authLog('No token found during initialization');
      setUser(null);
      setStatus('UNAUTHENTICATED');
      return false;
    }

    fetchingRef.current = true;
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
        return true;
      } else if (res.status === 401 || res.status === 403) {
        authLog('GET /api/users/me returned auth failure status:', res.status);
        handleAuthenticationFailure(`Server returned ${res.status}`);
        setUser(null);
        setStatus('UNAUTHENTICATED');
        return false;
      } else {
        authLog('GET /api/users/me server error (5xx or non-401):', res.status);
        // Do NOT wipe auth storage on 5xx server errors; preserve token for recovery
        setStatus(user ? 'AUTHENTICATED' : 'UNAUTHENTICATED');
        return false;
      }
    } catch (err: any) {
      authLog('Network exception fetching /api/users/me:', err?.message);
      // Network failure (offline/gateway timeout) should NOT blow away local session
      setStatus(user ? 'AUTHENTICATED' : 'UNAUTHENTICATED');
      return false;
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Single initialization on mount
  useEffect(() => {
    authLog('Initializing authentication context...');
    fetchCurrentUser();

    // Cross-tab BroadcastChannel listener
    const handleBroadcastMessage = (event: MessageEvent) => {
      authLog('BroadcastChannel message received:', event.data);
      if (event.data?.type === 'LOGOUT') {
        setUser(null);
        setStatus('UNAUTHENTICATED');
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
        } else {
          fetchCurrentUser();
        }
      }
    };

    const handleAuthLogoutEvent = () => {
      setUser(null);
      setStatus('UNAUTHENTICATED');
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-logout', handleAuthLogoutEvent);

    return () => {
      if (authChannel) {
        authChannel.onmessage = null;
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-logout', handleAuthLogoutEvent);
    };
  }, [fetchCurrentUser]);

  // Logout handler
  const logout = async (): Promise<void> => {
    authLog('Logout requested');
    try {
      await authFetch(`${API_URL}/users/logout`, { method: 'POST' });
    } catch (e) {
      authLog('Backend logout request failed:', e);
    } finally {
      clearAuthState();
      setUser(null);
      setStatus('UNAUTHENTICATED');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  };

  // Called when login form succeeds
  const loginSuccess = (token: string, userData: any) => {
    authLog('Login success event handled');
    const role = userData?.role || userData?.user?.role;
    setAuthState(token, role);
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
