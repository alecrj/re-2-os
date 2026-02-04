import { db } from "@/server/db/client";
import { auth } from "@/server/auth";

/**
 * Session user type from NextAuth
 */
export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * Session type from NextAuth
 */
export interface Session {
  user: SessionUser;
  accessToken?: string;
  error?: string;
  expires: string;
}

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/v10/context
 */
export async function createContext() {
  // Get the session from NextAuth
  const session = await auth();

  return {
    db,
    session: session as Session | null,
    user: session?.user as SessionUser | null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
