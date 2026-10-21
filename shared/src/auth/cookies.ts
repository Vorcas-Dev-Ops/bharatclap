import type { Request } from 'express';

export const ACCESS_COOKIE = 'access_token';

export const readAccessToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const parsed = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  if (parsed) return parsed;
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
};

export const isCookieAuthenticated = (req: Request): boolean =>
  !req.headers.authorization && Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.jwt);

// Blocks cross-site form posts and fetches that carry cookies.
// Bearer requests are exempt, so mobile clients are unaffected.
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const requireCsrfForCookieAuth = (req: Request, res: any, next: () => void) => {
  if (!MUTATING.has(req.method)) return next();
  if (!isCookieAuthenticated(req)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ message: 'Missing CSRF header' });
  }
  next();
};
