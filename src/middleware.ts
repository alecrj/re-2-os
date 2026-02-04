/**
 * NextAuth.js Middleware for Route Protection
 *
 * Uses edge-compatible auth config (no database adapter).
 * Protects dashboard routes and redirects unauthenticated users to login.
 */
import NextAuth from "next-auth";
import { edgeAuthConfig, protectedPaths } from "@/server/auth/edge-config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(edgeAuthConfig);

/**
 * Auth routes - redirect to dashboard if already authenticated
 */
const authPaths = ["/login"];

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;

  // Check if current path is protected
  const isProtectedPath = protectedPaths.some((path) =>
    nextUrl.pathname.startsWith(path)
  );

  // Check if current path is an auth page
  const isAuthPath = authPaths.some((path) =>
    nextUrl.pathname.startsWith(path)
  );

  // Redirect unauthenticated users from protected paths to login
  if (isProtectedPath && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from auth pages to dashboard
  if (isAuthPath && isLoggedIn) {
    return NextResponse.redirect(new URL("/inventory", nextUrl.origin));
  }

  return NextResponse.next();
});

/**
 * Middleware config - run on all routes except static files and API
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
