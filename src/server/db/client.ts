import { drizzle as drizzleSqlite, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import * as schema from "./schema";

// Determine if we're using Turso (libsql) or local SQLite
const isTurso = process.env.DATABASE_URL?.startsWith("libsql://");

// Create the appropriate database connection
// We use BetterSQLite3Database as the type since both drivers have compatible query APIs
let db: BetterSQLite3Database<typeof schema>;

if (isTurso) {
  // Turso / libsql for production
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  // Cast to the sqlite type - the APIs are compatible
  db = drizzleLibsql(client, { schema }) as unknown as BetterSQLite3Database<typeof schema>;
} else {
  // Local SQLite for development
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

// Export database type
export type { BetterSQLite3Database as Database };
