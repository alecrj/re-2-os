/**
 * Custom Auth.js adapter for Turso/libsql
 *
 * The standard DrizzleAdapter has issues with libsql's HTTP client.
 * This adapter handles the async nature of libsql properly.
 */
import type { Adapter, AdapterAccount, AdapterUser, AdapterSession } from "next-auth/adapters";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users, accounts, sessions, verificationTokens } from "@/server/db/schema";

export function TursoAdapter(): Adapter {
  return {
    async createUser(data) {
      const id = crypto.randomUUID();
      const now = new Date();

      await db.insert(users).values({
        id,
        email: data.email,
        emailVerified: data.emailVerified,
        name: data.name,
        image: data.image,
        createdAt: now,
        updatedAt: now,
      });

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return user[0] as AdapterUser;
    },

    async getUser(id) {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return result[0] as AdapterUser | null;
    },

    async getUserByEmail(email) {
      if (!email) return null;

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      return result[0] as AdapterUser | null;
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const result = await db
        .select({
          user: users,
        })
        .from(accounts)
        .innerJoin(users, eq(accounts.userId, users.id))
        .where(
          and(
            eq(accounts.providerAccountId, providerAccountId),
            eq(accounts.provider, provider)
          )
        )
        .limit(1);

      return result[0]?.user as AdapterUser | null;
    },

    async updateUser(data) {
      if (!data.id) throw new Error("User id is required");

      await db
        .update(users)
        .set({
          email: data.email,
          emailVerified: data.emailVerified,
          name: data.name,
          image: data.image,
          updatedAt: new Date(),
        })
        .where(eq(users.id, data.id));

      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, data.id))
        .limit(1);

      return result[0] as AdapterUser;
    },

    async deleteUser(userId) {
      await db.delete(users).where(eq(users.id, userId));
    },

    async linkAccount(account) {
      await db.insert(accounts).values({
        id: crypto.randomUUID(),
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refresh_token,
        access_token: account.access_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
        session_state: account.session_state as string | undefined,
      });

      return account as AdapterAccount;
    },

    async unlinkAccount({ providerAccountId, provider }) {
      await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.providerAccountId, providerAccountId),
            eq(accounts.provider, provider)
          )
        );
    },

    async createSession(data) {
      await db.insert(sessions).values({
        sessionToken: data.sessionToken,
        userId: data.userId,
        expires: data.expires,
      });

      return data as AdapterSession;
    },

    async getSessionAndUser(sessionToken) {
      const result = await db
        .select({
          session: sessions,
          user: users,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.sessionToken, sessionToken))
        .limit(1);

      if (!result[0]) return null;

      return {
        session: result[0].session as AdapterSession,
        user: result[0].user as AdapterUser,
      };
    },

    async updateSession(data) {
      await db
        .update(sessions)
        .set({
          expires: data.expires,
        })
        .where(eq(sessions.sessionToken, data.sessionToken));

      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionToken, data.sessionToken))
        .limit(1);

      return result[0] as AdapterSession | null;
    },

    async deleteSession(sessionToken) {
      await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
    },

    async createVerificationToken(data) {
      await db.insert(verificationTokens).values({
        identifier: data.identifier,
        token: data.token,
        expires: data.expires,
      });

      return data;
    },

    async useVerificationToken({ identifier, token }) {
      const result = await db
        .select()
        .from(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, token)
          )
        )
        .limit(1);

      if (!result[0]) return null;

      await db
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, token)
          )
        );

      return result[0];
    },
  };
}
