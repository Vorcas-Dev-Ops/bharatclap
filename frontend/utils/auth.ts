import Cookies from 'js-cookie';

export type AuthStatus = 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

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
    // 1. Clear LocalStorage and SessionStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user'); // Cleanup any legacy user objects
    localStorage.removeItem('jwt');
    sessionStorage.removeItem('token');

    // 2. Clear Cookies with explicit root path
    Cookies.remove('token', { path: '/' });
    Cookies.remove('userRole', { path: '/' });
    Cookies.remove('jwt', { path: '/' });

    // Fallback document.cookie cleanup
    document.cookie = 'token=; Max-Age=0; path=/;';
    document.cookie = 'userRole=; Max-Age=0; path=/;';
    document.cookie = 'jwt=; Max-Age=0; path=/;';

    // 3. Notify other tabs via BroadcastChannel & window event
    try {
      authChannel?.postMessage({ type: 'LOGOUT' });
    } catch {}

    window.dispatchEvent(new Event('auth-logout'));
  }
};

/**
 * Persist access token and user role to storage and cookies
 */
export const setAuthState = (token: string, role?: string): void => {
  loggingOutInProcess = false;
  authLog('Setting client authentication state for role:', role);

  if (isBrowser) {
    if (token) {
      localStorage.setItem('token', token);
      Cookies.set('token', token, { expires: 7, path: '/' });
    }
    if (role) {
      Cookies.set('userRole', role, { expires: 7, path: '/' });
    }

    try {
      authChannel?.postMessage({ type: 'LOGIN' });
    } catch {}

    window.dispatchEvent(new Event('auth-login'));
  }
};

/**
 * Centralized authentication error handler
 */
export const handleAuthenticationFailure = (reason: string): void => {
  authLog('Authentication failure:', reason);
  clearAuthState();
  if (isBrowser && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};
