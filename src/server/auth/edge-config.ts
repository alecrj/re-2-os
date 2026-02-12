/**
 * Edge-compatible NextAuth.js Configuration
 *
 * This config is used by middleware and doesn't include the database adapter.
 * The full config with adapter is in config.ts for API routes.
 */
import type { NextAuthConfig } from "next-auth";

/**
 * Protected paths that require authentication
 */
export const protectedPaths = [
  "/dashboard",
  "/inventory",
  "/listings",
  "/orders",
  "/analytics",
  "/settings",
];

/**
 * Edge-compatible auth config (no database adapter)
 */
export const edgeAuthConfig: NextAuthConfig = {
  providers: [], // Providers configured in full config

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = protectedPaths.some((path) =>
        nextUrl.pathname.startsWith(path)
      );

      if (isProtected && !isLoggedIn) {
        return false; // Redirect to login
      }

      return true;
    },
  },
};

export default edgeAuthConfig;
