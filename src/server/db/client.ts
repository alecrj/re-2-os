import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import * as schema from "./schema";

// Determine if we're using Turso (libsql) or local SQLite
const isTurso = process.env.DATABASE_URL?.startsWith("libsql://");

// Create the appropriate database connection
// Using 'any' to handle union type issues between sync/async drizzle instances
// Both drivers have compatible query APIs at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

if (isTurso) {
  // Turso / libsql for production (async client)
  console.log("[DB] Using Turso/libsql");
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  db = drizzleLibsql(client, { schema });
} else {
  // Local SQLite for development (sync client)
  console.log("[DB] Using local SQLite");
  const getDatabasePath = (): string => {
    const url = process.env.DATABASE_URL || "file:./data/reselleros.db";
    if (url.startsWith("file:")) {
      return url.slice(5);
    }
    return url;
  };

  const sqlite = new Database(getDatabasePath());
  sqlite.pragma("journal_mode = WAL");
  db = drizzleSqlite(sqlite, { schema });
}

export { db };
export type Database = typeof db;
