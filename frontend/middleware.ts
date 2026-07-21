import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
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
    "/beauty",
  ];

  // Check if current path is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // 2. If not authenticated and trying to access a protected route
  if (!token && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
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
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|uploads).*)",
  ],
};
