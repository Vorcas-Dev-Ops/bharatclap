import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const protectedPrefixes = ["/admin", "/provider", "/user"];
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (isProtectedRoute) {
    const rawToken = request.cookies.get("token")?.value;
    const token = rawToken && rawToken !== "null" && rawToken !== "undefined" && rawToken.trim() !== "" ? rawToken : null;
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
