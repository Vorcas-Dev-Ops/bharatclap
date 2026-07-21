import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const rawToken = request.cookies.get("token")?.value;
  const token = rawToken && rawToken !== "null" && rawToken !== "undefined" && rawToken.trim() !== "" ? rawToken : null;
  const userRole = request.cookies.get("userRole")?.value;
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

  if (!token && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token) {
    if (pathname === "/login" || pathname === "/signup") {
      if (userRole?.toLowerCase() === "admin" || userRole?.toLowerCase() === "super_admin") return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      if (userRole?.toLowerCase() === "provider") return NextResponse.redirect(new URL("/provider/dashboard", request.url));
      return NextResponse.redirect(new URL("/", request.url));
    }

    const isAdmin = userRole?.toLowerCase() === "admin" || userRole?.toLowerCase() === "super_admin";
    if (pathname.startsWith("/admin") && !isAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname.startsWith("/provider") && userRole?.toLowerCase() !== "provider") {
      return NextResponse.redirect(new URL("/", request.url));
    }
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
