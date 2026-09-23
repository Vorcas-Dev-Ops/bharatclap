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

  const rawToken = request.cookies.get("token")?.value;
  const token = rawToken && rawToken !== "null" && rawToken !== "undefined" && rawToken.trim() !== "" ? rawToken : null;
  const cookieRole = (request.cookies.get("userRole")?.value || "").toLowerCase();

  const protectedPrefixes = ["/admin", "/provider", "/user"];
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  // Helper to attach no-cache headers to responses to prevent browser bfcache leaks
  const applyNoCacheHeaders = (res: NextResponse) => {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
    return res;
  };

  // If token is present, validate structure and expiry
  let isValidToken = false;
  let tokenRole = cookieRole;

  if (token) {
    const payload = parseJwtPayload(token);
    if (payload) {
      const nowSec = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp && payload.exp < nowSec;
      
      const jwtSecret = process.env.JWT_SECRET;
      let signatureValid = true;
      if (jwtSecret) {
        signatureValid = await verifyJwtSignature(token, jwtSecret);
      }

      if (!isExpired && signatureValid) {
        isValidToken = true;
        tokenRole = (payload.role || cookieRole || "").toLowerCase();
      }
    }
  }

  // 1. Prevent authenticated users with valid token from visiting /login via direct entry or Back button
  if (pathname === "/login" && isValidToken) {
    let targetDashboard = "/";
    const adminRoles = ["admin", "super_admin", "operations_admin", "support_admin", "finance_admin"];
    if (adminRoles.includes(tokenRole)) {
      targetDashboard = "/admin/dashboard";
    } else if (tokenRole === "provider") {
      targetDashboard = "/provider/dashboard";
    }
    return applyNoCacheHeaders(NextResponse.redirect(new URL(targetDashboard, request.url)));
  }

  // 2. Prevent unauthenticated / invalid token users from visiting protected routes
  if (isProtectedRoute && !isValidToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const redirectRes = applyNoCacheHeaders(NextResponse.redirect(loginUrl));
    if (rawToken) {
      // Clear invalid/expired cookie
      redirectRes.cookies.delete("token");
      redirectRes.cookies.delete("userRole");
    }
    return redirectRes;
  }

  // 3. Enforce RBAC on protected sections
  if (isProtectedRoute && isValidToken) {
    const adminRoles = ["admin", "super_admin", "operations_admin", "support_admin", "finance_admin"];
    if (pathname.startsWith("/admin") && !adminRoles.includes(tokenRole)) {
      return applyNoCacheHeaders(NextResponse.redirect(new URL("/", request.url)));
    }
    if (pathname.startsWith("/provider") && tokenRole !== "provider" && !adminRoles.includes(tokenRole)) {
      return applyNoCacheHeaders(NextResponse.redirect(new URL("/", request.url)));
    }
  }

  // 4. Apply Cache-Control no-store headers for all protected & auth routes
  const response = NextResponse.next();
  if (isProtectedRoute || pathname === "/login") {
    applyNoCacheHeaders(response);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
