/**
 * Auth utilities for client-side use
 *
 * Re-exports from next-auth/react for convenience.
 */
export {
  signIn,
  signOut,
  useSession,
  getSession,
  SessionProvider,
} from "next-auth/react";

/**
 * Server-side auth helper
 *
 * Import this for server components or API routes.
 */
export { auth } from "@/server/auth";
