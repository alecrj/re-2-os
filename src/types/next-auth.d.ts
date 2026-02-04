/**
 * NextAuth.js Type Declarations
 *
 * Extends the default NextAuth types with our custom session properties.
 */
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extended Session interface
   */
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    accessToken?: string;
    error?: string;
  }

  /**
   * Extended User interface
   */
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extended JWT interface
   */
  interface JWT {
    userId?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    provider?: string;
    error?: string;
  }
}
