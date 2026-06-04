import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const rawToken = request.cookies.get("token")?.value;
  const token = rawToken && rawToken !== "null" && rawToken !== "undefined" && rawToken.trim() !== "" ? rawToken : null;
  const userRole = request.cookies.get("userRole")?.value;
  const pathname = request.nextUrl.pathname;

  // 1. Define Public Routes
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
  ];

  // Check if current path is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // 2. If not authenticated and trying to access a protected route
  if (!token && !isPublicRoute) {
    // Redirect to home as per user request
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 3. Role-Based Protection (Authorized users only)
  if (token) {
    // Prevent logged in users from accessing login/signup pages
    if (pathname === "/login" || pathname === "/signup") {
        if (userRole?.toLowerCase() === "admin") return NextResponse.redirect(new URL("/admin/dashboard", request.url));
        if (userRole?.toLowerCase() === "provider") return NextResponse.redirect(new URL("/provider/dashboard", request.url));
        return NextResponse.redirect(new URL("/", request.url));
    }

    // Protect Admin routes
    if (pathname.startsWith("/admin") && userRole?.toLowerCase() !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Protect Provider routes
    if (pathname.startsWith("/provider") && userRole?.toLowerCase() !== "provider") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Protect User routes from Admin/Provider if they shouldn't access them
    // (Optional, usually customers are /user/*)
    if (pathname.startsWith("/user") && userRole === "admin") {
        // Admins might not need to see user bookings/cart, but let's be careful.
        // Usually, we just allow customers to access /user/*
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (backend routes handled separately)
     * - _next (Next.js internals)
     * - static files (images, css, etc.)
     * - favicon.ico, images, etc.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|images|uploads).*)",
  ],
};
