/**
 * NextAuth.js API Route
 *
 * Handles all authentication routes:
 * - /api/auth/signin
 * - /api/auth/signout
 * - /api/auth/callback/:provider
 * - /api/auth/session
 * - /api/auth/csrf
 * - /api/auth/providers
 */
import { GET, POST } from "@/server/auth";

export { GET, POST };
