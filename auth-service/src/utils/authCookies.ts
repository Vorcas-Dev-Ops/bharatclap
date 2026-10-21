import { Request, Response } from 'express';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'jwt';
export const REFRESH_PATH = '/api/users/refresh';
export const ACCESS_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const isSecureCookie = (): boolean => process.env.COOKIE_SECURE !== 'false';

export const clientOf = (req: Request): 'web' | 'mobile' => {
  const headerVal = req.get ? req.get('X-Client') : (req.headers && (req.headers['x-client'] || req.headers['X-Client']));
  return headerVal === 'web' ? 'web' : 'mobile';
};

export const bodyToken = (client: 'web' | 'mobile', accessToken: string): Record<string, string> => ({
  token: accessToken,
  accessToken,
});

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
  maxAgeMs: number
): void => {
  const secure = isSecureCookie();

  // 1. Short-lived Access Token Cookie (15m, Lax, Path=/)
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: ACCESS_MAX_AGE_MS,
    path: '/',
  });

  // 2. Long-lived Refresh Token Cookie (Strict, Path=/api/users/refresh)
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: maxAgeMs,
    path: REFRESH_PATH,
  });

  // 3. Clear legacy Refresh Token Cookie at Path=/ to prevent duplicate cookie ambiguity
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
};

export const setAccessCookie = (res: Response, accessToken: string): void => {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    maxAge: ACCESS_MAX_AGE_MS,
    path: '/',
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
};
