/**
 * Custom Auth.js adapter for Turso/libsql
 *
 * Uses raw SQL queries via @libsql/client to ensure compatibility
 * with Turso's HTTP-based API.
 */
import type { Adapter, AdapterAccount, AdapterUser, AdapterSession } from "next-auth/adapters";
import { createClient } from "@libsql/client";

// Create a dedicated libsql client for auth operations
const getAuthClient = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function TursoAdapter(): Adapter {
  const client = getAuthClient();

  return {
    async createUser(data) {
      const id = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      await client.execute({
        sql: `INSERT INTO users (id, email, emailVerified, name, image, created_at, updated_at, tier)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'free')`,
        args: [
          id,
          data.email ?? null,
          data.emailVerified ? Math.floor(data.emailVerified.getTime() / 1000) : null,
          data.name ?? null,
          data.image ?? null,
          now,
          now,
        ],
      });

      return {
        id,
        email: data.email ?? null,
        emailVerified: data.emailVerified ?? null,
        name: data.name ?? null,
        image: data.image ?? null,
      } as AdapterUser;
    },

    async getUser(id) {
      const result = await client.execute({
        sql: `SELECT id, email, emailVerified, name, image FROM users WHERE id = ?`,
        args: [id],
      });

      const row = result.rows[0] as Row | undefined;
      if (!row) return null;

      return {
        id: row.id as string,
        email: row.email as string | null,
        emailVerified: row.emailVerified ? new Date(row.emailVerified * 1000) : null,
        name: row.name as string | null,
        image: row.image as string | null,
      } as AdapterUser;
    },

    async getUserByEmail(email) {
      if (!email) return null;

      const result = await client.execute({
        sql: `SELECT id, email, emailVerified, name, image FROM users WHERE email = ?`,
        args: [email],
      });

      const row = result.rows[0] as Row | undefined;
      if (!row) return null;

      return {
        id: row.id as string,
        email: row.email as string | null,
        emailVerified: row.emailVerified ? new Date(row.emailVerified * 1000) : null,
        name: row.name as string | null,
        image: row.image as string | null,
      } as AdapterUser;
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const result = await client.execute({
        sql: `SELECT u.id, u.email, u.emailVerified, u.name, u.image
              FROM accounts a
              INNER JOIN users u ON a.userId = u.id
              WHERE a.providerAccountId = ? AND a.provider = ?`,
        args: [providerAccountId, provider],
      });

      const row = result.rows[0] as Row | undefined;
      if (!row) return null;

      return {
        id: row.id as string,
        email: row.email as string | null,
        emailVerified: row.emailVerified ? new Date(row.emailVerified * 1000) : null,
        name: row.name as string | null,
        image: row.image as string | null,
      } as AdapterUser;
    },

    async updateUser(data) {
      if (!data.id) throw new Error("User id is required");

      const updates: string[] = [];
      const args: (string | number | null)[] = [];

      if (data.email !== undefined) {
        updates.push("email = ?");
        args.push(data.email);
      }
      if (data.emailVerified !== undefined) {
        updates.push("emailVerified = ?");
        args.push(data.emailVerified ? Math.floor(data.emailVerified.getTime() / 1000) : null);
      }
      if (data.name !== undefined) {
        updates.push("name = ?");
        args.push(data.name);
      }
      if (data.image !== undefined) {
        updates.push("image = ?");
        args.push(data.image);
      }

      updates.push("updated_at = ?");
      args.push(Math.floor(Date.now() / 1000));
      args.push(data.id);

      await client.execute({
        sql: `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
        args,
      });

      const result = await client.execute({
        sql: `SELECT id, email, emailVerified, name, image FROM users WHERE id = ?`,
        args: [data.id],
      });

      const row = result.rows[0] as Row;
      return {
        id: row.id as string,
        email: row.email as string | null,
        emailVerified: row.emailVerified ? new Date(row.emailVerified * 1000) : null,
        name: row.name as string | null,
        image: row.image as string | null,
      } as AdapterUser;
    },

    async deleteUser(userId) {
      await client.execute({
        sql: `DELETE FROM users WHERE id = ?`,
        args: [userId],
      });
    },

    async linkAccount(account) {
      const id = crypto.randomUUID();

      await client.execute({
        sql: `INSERT INTO accounts (id, userId, type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
          (account.session_state as string) ?? null,
        ],
      });

      return account as AdapterAccount;
    },

    async unlinkAccount({ providerAccountId, provider }) {
      await client.execute({
        sql: `DELETE FROM accounts WHERE providerAccountId = ? AND provider = ?`,
        args: [providerAccountId, provider],
      });
    },

    async createSession(data) {
      await client.execute({
        sql: `INSERT INTO sessions (sessionToken, userId, expires)
              VALUES (?, ?, ?)`,
        args: [
          data.sessionToken,
          data.userId,
          Math.floor(data.expires.getTime() / 1000),
        ],
      });

      return data as AdapterSession;
    },

    async getSessionAndUser(sessionToken) {
      const result = await client.execute({
        sql: `SELECT s.sessionToken, s.userId, s.expires,
                     u.id, u.email, u.emailVerified, u.name, u.image
              FROM sessions s
              INNER JOIN users u ON s.userId = u.id
              WHERE s.sessionToken = ?`,
        args: [sessionToken],
      });

      const row = result.rows[0] as Row | undefined;
      if (!row) return null;

      return {
        session: {
          sessionToken: row.sessionToken as string,
          userId: row.userId as string,
          expires: new Date(row.expires * 1000),
        } as AdapterSession,
        user: {
          id: row.id as string,
          email: row.email as string | null,
          emailVerified: row.emailVerified ? new Date(row.emailVerified * 1000) : null,
          name: row.name as string | null,
          image: row.image as string | null,
        } as AdapterUser,
      };
    },

    async updateSession(data) {
      if (data.expires) {
        await client.execute({
          sql: `UPDATE sessions SET expires = ? WHERE sessionToken = ?`,
          args: [Math.floor(data.expires.getTime() / 1000), data.sessionToken],
        });
      }

      const result = await client.execute({
        sql: `SELECT sessionToken, userId, expires FROM sessions WHERE sessionToken = ?`,
        args: [data.sessionToken],
      });

      const row = result.rows[0] as Row | undefined;
      if (!row) return null;

      return {
        sessionToken: row.sessionToken as string,
        userId: row.userId as string,
        expires: new Date(row.expires * 1000),
      } as AdapterSession;
    },

    async deleteSession(sessionToken) {
      await client.execute({
        sql: `DELETE FROM sessions WHERE sessionToken = ?`,
        args: [sessionToken],
      });
    },

    async createVerificationToken(data) {
      await client.execute({
        sql: `INSERT INTO verificationTokens (identifier, token, expires)
              VALUES (?, ?, ?)`,
        args: [
          data.identifier,
          data.token,
          Math.floor(data.expires.getTime() / 1000),
        ],
      });

      return data;
    },

    async useVerificationToken({ identifier, token }) {
      const result = await client.execute({
        sql: `SELECT identifier, token, expires FROM verificationTokens
              WHERE identifier = ? AND token = ?`,
        args: [identifier, token],
      });

      const row = result.rows[0] as Row | undefined;
      if (!row) return null;

      await client.execute({
        sql: `DELETE FROM verificationTokens WHERE identifier = ? AND token = ?`,
        args: [identifier, token],
      });

      return {
        identifier: row.identifier as string,
        token: row.token as string,
        expires: new Date(row.expires * 1000),
      };
    },
  };
}
