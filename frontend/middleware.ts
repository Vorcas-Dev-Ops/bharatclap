import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

async function verifyJwtSignature(token: string, secretStr: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [header, payload, signature] = parts;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secretStr),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBase64 = signature.replace(/-/g, "+").replace(/_/g, "/");
    const binarySig = atob(sigBase64);
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }
    const data = enc.encode(`${header}.${payload}`);
    return await crypto.subtle.verify("HMAC", key, sigBytes, data);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const rawToken = request.cookies.get("access_token")?.value || request.cookies.get("token")?.value;
  const token = rawToken && rawToken !== "null" && rawToken !== "undefined" && rawToken.trim() !== "" ? rawToken : null;
  const hasSessionHint = request.cookies.get("session_hint")?.value === "1";
  const cookieRole = (request.cookies.get("userRole")?.value || "").toLowerCase();

  const isPublicAuthRoute =
    pathname === "/admin/login" ||
    pathname === "/login" ||
    pathname === "/provider/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/signup") ||
    pathname === "/join-as-provider" ||
    pathname === "/provider/register";
  const protectedPrefixes = ["/admin", "/provider", "/user"];
  const isProtectedRoute = !isPublicAuthRoute && protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  // Helper to attach no-cache headers to responses to prevent browser bfcache leaks
  const applyNoCacheHeaders = (res: NextResponse) => {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
    return res;
  };

  // If token is present, validate structure, signature, and expiry
  let isValidToken = false;
  let tokenRole = "";

  if (token) {
    const payload = parseJwtPayload(token);
    if (payload) {
      const nowSec = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp && payload.exp < nowSec;
      
      const jwtSecret = process.env.JWT_SECRET;
      // Fail closed: if JWT_SECRET is missing or signature check fails, do not trust token
      if (jwtSecret && !isExpired) {
        const signatureValid = await verifyJwtSignature(token, jwtSecret);
        if (signatureValid) {
          isValidToken = true;
          tokenRole = (payload.role || "").toLowerCase();
        }
      }
    }
  }

  // 1. Prevent authenticated users with valid token from visiting their matching login or signup pages
  const isRelogin = request.nextUrl.searchParams.has("relogin") || request.nextUrl.searchParams.has("force");
  if (isRelogin && isPublicAuthRoute) {
    const res = NextResponse.next();
    res.cookies.set("access_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("token", "", { maxAge: 0, path: "/" });
    res.cookies.set("userRole", "", { maxAge: 0, path: "/" });
    res.cookies.set("session_hint", "", { maxAge: 0, path: "/" });
    return applyNoCacheHeaders(res);
  }

  if (isValidToken) {
    const adminRoles = ["admin", "super_admin", "operations_admin", "support_admin", "finance_admin"];
    if (pathname === "/admin/login" && adminRoles.includes(tokenRole)) {
      return applyNoCacheHeaders(NextResponse.redirect(new URL("/admin/dashboard", request.url)));
    }
    if (pathname === "/provider/login" && tokenRole === "provider") {
      return applyNoCacheHeaders(NextResponse.redirect(new URL("/provider/dashboard", request.url)));
    }
    if (pathname === "/login" || pathname === "/signup") {
      let targetDashboard = "/";
      if (adminRoles.includes(tokenRole)) {
        targetDashboard = "/admin/dashboard";
      } else if (tokenRole === "provider") {
        targetDashboard = "/provider/dashboard";
      }
      return applyNoCacheHeaders(NextResponse.redirect(new URL(targetDashboard, request.url)));
    }
  }

  // 2. Prevent unauthenticated / invalid token users from visiting protected routes
  if (isProtectedRoute && !isValidToken) {
    // If the browser has a session_hint cookie, a valid refresh session exists.
    // Allow the request through so the client-side app can refresh via /api/users/refresh without a jarring bounce.
    if (hasSessionHint) {
      const response = NextResponse.next();
      return applyNoCacheHeaders(response);
    }

    const targetLogin = pathname.startsWith("/admin")
      ? "/admin/login"
      : pathname.startsWith("/provider")
      ? "/provider/login"
      : "/login";
    const loginUrl = new URL(targetLogin, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const redirectRes = applyNoCacheHeaders(NextResponse.redirect(loginUrl));
    if (rawToken || request.cookies.get("session_hint")) {
      // Clear invalid/expired cookies across root path
      redirectRes.cookies.set("access_token", "", { maxAge: 0, path: "/" });
      redirectRes.cookies.set("token", "", { maxAge: 0, path: "/" });
      redirectRes.cookies.set("userRole", "", { maxAge: 0, path: "/" });
      redirectRes.cookies.set("session_hint", "", { maxAge: 0, path: "/" });
      redirectRes.cookies.delete("access_token");
      redirectRes.cookies.delete("token");
      redirectRes.cookies.delete("userRole");
      redirectRes.cookies.delete("session_hint");
    }
    return redirectRes;
  }

  // 3. Enforce RBAC on protected sections
  const effectiveRole = tokenRole || cookieRole;
  if (isProtectedRoute && effectiveRole) {
    const adminRoles = ["admin", "super_admin", "operations_admin", "support_admin", "finance_admin"];
    if (pathname.startsWith("/admin") && !adminRoles.includes(effectiveRole)) {
      return applyNoCacheHeaders(NextResponse.redirect(new URL("/", request.url)));
    }
    if (pathname.startsWith("/provider") && effectiveRole !== "provider" && !adminRoles.includes(effectiveRole)) {
      return applyNoCacheHeaders(NextResponse.redirect(new URL("/", request.url)));
    }
  }

  // 4. Apply Cache-Control no-store headers for all protected & auth routes
  const response = NextResponse.next();
  if (isProtectedRoute || isPublicAuthRoute) {
    applyNoCacheHeaders(response);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
