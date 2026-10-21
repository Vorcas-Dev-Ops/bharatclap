import Cookies from 'js-cookie';
import { disconnectSocket } from '@/services/socket';

export type AuthStatus = 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'AUTH_RECONNECTING';

const isBrowser = typeof window !== 'undefined';
let loggingOutInProcess = false;

export const getIsLoggingOut = (): boolean => loggingOutInProcess;

// Development-only auth lifecycle logger
export const authLog = (msg: string, ...args: any[]): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Auth] ${msg}`, ...args);
  }
};

// BroadcastChannel for instant cross-tab sync
export const authChannel: BroadcastChannel | null = isBrowser && 'BroadcastChannel' in window
  ? new BroadcastChannel('bharatclap_auth')
  : null;

/**
 * Clear all client-side authentication storage and notify all tabs/listeners
 */
export const clearAuthState = (): void => {
  loggingOutInProcess = true;
  authLog('Clearing client authentication state');

  if (isBrowser) {
    // 1. Sever any active WebSocket connections immediately
    try {
      disconnectSocket();
    } catch {}

    // 2. Clear LocalStorage and SessionStorage completely
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('session_hint');
    localStorage.removeItem('authUser');
    localStorage.removeItem('jwt');
    localStorage.removeItem('userLocation');
    localStorage.removeItem('userLocationId');
    localStorage.removeItem('userLocationObj');
    sessionStorage.clear();

    // 3. Clear Cookies with explicit root path and subpaths
    Cookies.remove('access_token', { path: '/' });
    Cookies.remove('token', { path: '/' });
    Cookies.remove('userRole', { path: '/' });
    Cookies.remove('session_hint', { path: '/' });
    Cookies.remove('jwt', { path: '/' });

    // Fallback document.cookie cleanup for all path variants
    const paths = ['/', '/admin', '/provider', '/user'];
    paths.forEach((p) => {
      document.cookie = `access_token=; Max-Age=0; path=${p};`;
      document.cookie = `token=; Max-Age=0; path=${p};`;
      document.cookie = `userRole=; Max-Age=0; path=${p};`;
      document.cookie = `session_hint=; Max-Age=0; path=${p};`;
      document.cookie = `jwt=; Max-Age=0; path=${p};`;
    });

    // 4. Notify other tabs via BroadcastChannel & window event
    try {
      authChannel?.postMessage({ type: 'LOGOUT' });
    } catch {}

    window.dispatchEvent(new Event('auth-logout'));
  }
};

/**
 * Persist access token and user role to storage and cookies
 */
export const setAuthState = (token?: string | null, role?: string | null): void => {
  loggingOutInProcess = false;
  authLog('Setting client authentication state for role:', role);

  if (isBrowser) {
    const isSecure = window.location.protocol === 'https:';
    const cookieOpts: Cookies.CookieAttributes = {
      expires: 7,
      path: '/',
      sameSite: 'lax',
      secure: isSecure,
    };
    Cookies.set('session_hint', '1', cookieOpts);
    localStorage.setItem('session_hint', '1');
    if (token) {
      localStorage.setItem('token', token);
      Cookies.set('token', token, cookieOpts);
      Cookies.set('access_token', token, cookieOpts);
    }
    if (role) {
      localStorage.setItem('userRole', role);
      Cookies.set('userRole', role, cookieOpts);
    }

    try {
      authChannel?.postMessage({ type: 'LOGIN' });
    } catch {}

    window.dispatchEvent(new Event('auth-login'));
  }
};

/**
 * Canonical logout helper: completely clears state and replaces window location
 */
export const logoutAndRedirect = (redirectUrl = '/login'): void => {
  clearAuthState();
  if (isBrowser) {
    window.location.replace(redirectUrl);
  }
};

/**
 * Centralized authentication error handler
 */
export const handleAuthenticationFailure = (reason: string, returnUrl?: string): void => {
  authLog('Authentication failure:', reason);
  clearAuthState();
  if (isBrowser) {
    const isCurrentAdmin = window.location.pathname.startsWith('/admin');
    const isCurrentProvider = window.location.pathname.startsWith('/provider');
    const targetLogin = isCurrentAdmin ? '/admin/login' : isCurrentProvider ? '/provider/login' : '/login';
    const dest = returnUrl
      ? `${targetLogin}?relogin=true&returnUrl=${encodeURIComponent(returnUrl)}`
      : `${targetLogin}?relogin=true`;
    if (window.location.pathname !== targetLogin) {
      window.location.replace(dest);
    }
  }
};
