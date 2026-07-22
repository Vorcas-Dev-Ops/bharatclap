import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight Next.js Edge Middleware
 * Purely checks route protection requirement. Actual token validation belongs
 * exclusively to AuthProvider -> Backend GET /api/users/me.
 */
export function proxy(request: NextRequest) {
  const rawToken = request.cookies.get("token")?.value;
  const token = rawToken && rawToken !== "null" && rawToken !== "undefined" && rawToken.trim() !== "" ? rawToken : null;
  const pathname = request.nextUrl.pathname;

  const publicRoutes = [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/about",
    "/contact",
    "/services",
    "/categories",
    "/category",
    "/service",
    "/join-as-partner",
    "/beauty",
  ];

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Redirect unauthenticated requests accessing protected routes to /login
  if (!token && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const middleware = proxy;
export default proxy;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|uploads).*)",
  ],
};
