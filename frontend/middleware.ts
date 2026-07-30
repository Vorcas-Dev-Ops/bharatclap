import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const rawToken = request.cookies.get("token")?.value;
  const token = rawToken && rawToken !== "null" && rawToken !== "undefined" && rawToken.trim() !== "" ? rawToken : null;
  const userRole = (request.cookies.get("userRole")?.value || "").toLowerCase();

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

  // 1. Prevent authenticated users from visiting /login via direct entry or Back button
  if (pathname === "/login" && token) {
    let targetDashboard = "/";
    if (userRole === "admin" || userRole === "super_admin") {
      targetDashboard = "/admin/dashboard";
    } else if (userRole === "provider") {
      targetDashboard = "/provider/dashboard";
    }
    return applyNoCacheHeaders(NextResponse.redirect(new URL(targetDashboard, request.url)));
  }

  // 2. Prevent unauthenticated users from visiting protected routes
  if (isProtectedRoute && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return applyNoCacheHeaders(NextResponse.redirect(loginUrl));
  }

  // 3. Apply Cache-Control no-store headers for all protected & auth routes
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
