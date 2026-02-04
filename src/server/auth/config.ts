/**
 * NextAuth.js Configuration for ResellerOS
 *
 * Uses eBay OAuth as the primary authentication method.
 * Stores user data and channel connections in the database.
 */
import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/server/db/client";
import { EbayProvider, refreshEbayToken } from "./ebay-provider";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  channelConnections,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * eBay environment from env vars
 */
const ebayEnvironment =
  (process.env.EBAY_ENVIRONMENT as "sandbox" | "production") ?? "sandbox";

/**
 * Protected paths that require authentication
 */
const protectedPaths = [
  "/inventory",
  "/listings",
  "/orders",
  "/analytics",
  "/settings",
];

/**
 * NextAuth configuration
 */
export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

  providers: [
    EbayProvider({
      clientId: process.env.EBAY_CLIENT_ID!,
      clientSecret: process.env.EBAY_CLIENT_SECRET!,
      environment: ebayEnvironment,
      // Add more scopes as needed for full API access
      scopes: [
        "https://api.ebay.com/oauth/api_scope",
        "https://api.ebay.com/oauth/api_scope/sell.inventory",
        "https://api.ebay.com/oauth/api_scope/sell.marketing",
        "https://api.ebay.com/oauth/api_scope/sell.account",
        "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
      ],
    }),
  ],

  // Use JWT strategy for serverless compatibility
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/login",
    error: "/login", // Redirect to login page on error
  },

  callbacks: {
    /**
     * JWT callback - called whenever a JWT is created or updated
     */
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        // Store the eBay tokens in the JWT
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.userId = user.id;
        token.provider = account.provider;

        // Also store/update the channel connection
        await syncChannelConnection(user.id, account);
      }

      // Check if token needs refresh (5 minute buffer)
      const shouldRefresh =
        token.expiresAt && Date.now() / 1000 > (token.expiresAt as number) - 300;

      if (shouldRefresh && token.refreshToken && token.provider === "ebay") {
        const refreshed = await refreshEbayToken(
          token.refreshToken as string,
          process.env.EBAY_CLIENT_ID!,
          process.env.EBAY_CLIENT_SECRET!,
          ebayEnvironment
        );

        if (refreshed) {
          token.accessToken = refreshed.access_token;
          token.refreshToken = refreshed.refresh_token;
          token.expiresAt = refreshed.expires_at;

          // Update the channel connection with new tokens
          if (token.userId) {
            await updateChannelTokens(
              token.userId as string,
              "ebay",
              refreshed
            );
          }
        } else {
          // Token refresh failed - mark as expired
          token.error = "RefreshTokenError";
        }
      }

      return token;
    },

    /**
     * Session callback - called whenever a session is accessed
     */
    async session({ session, token }) {
      // Add custom properties to the session
      if (token) {
        session.user.id = token.userId as string;
        session.accessToken = token.accessToken as string;
        session.error = token.error as string | undefined;
      }

      return session;
    },

    /**
     * Authorized callback - for middleware protection
     */
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

  debug: process.env.NODE_ENV === "development",
};

/**
 * Sync eBay OAuth tokens to channelConnections table
 */
async function syncChannelConnection(
  userId: string,
  account: {
    provider: string;
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
    providerAccountId: string;
  }
) {
  if (account.provider !== "ebay") return;

  const existing = await db
    .select()
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.userId, userId),
        eq(channelConnections.channel, "ebay")
      )
    )
    .limit(1);

  const now = new Date();
  const tokenExpiry = account.expires_at
    ? new Date(account.expires_at * 1000)
    : null;

  if (existing.length > 0) {
    // Update existing connection
    await db
      .update(channelConnections)
      .set({
        accessToken: account.access_token ?? undefined,
        refreshToken: account.refresh_token ?? undefined,
        tokenExpiresAt: tokenExpiry,
        externalUserId: account.providerAccountId,
        status: "active",
        lastSyncAt: now,
      })
      .where(eq(channelConnections.id, existing[0].id));
  } else {
    // Create new connection
    await db.insert(channelConnections).values({
      id: crypto.randomUUID(),
      userId,
      channel: "ebay",
      accessToken: account.access_token ?? undefined,
      refreshToken: account.refresh_token ?? undefined,
      tokenExpiresAt: tokenExpiry,
      externalUserId: account.providerAccountId,
      status: "active",
      createdAt: now,
    });
  }
}

/**
 * Update channel tokens after refresh
 */
async function updateChannelTokens(
  userId: string,
  channel: "ebay" | "poshmark" | "mercari" | "depop",
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  }
) {
  await db
    .update(channelConnections)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(tokens.expires_at * 1000),
      status: "active",
      lastSyncAt: new Date(),
    })
    .where(
      and(
        eq(channelConnections.userId, userId),
        eq(channelConnections.channel, channel)
      )
    );
}

export default authConfig;
