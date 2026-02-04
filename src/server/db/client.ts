import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

// Determine database path from environment or use default
const getDatabasePath = (): string => {
  const url = process.env.DATABASE_URL || "file:./data/reselleros.db";

  // Handle file: prefix for SQLite
  if (url.startsWith("file:")) {
    return url.slice(5);
  }

  // If it's a Turso URL, we'd need different handling
  // For now, assume local SQLite
  return url;
};

// Create SQLite database connection
const sqlite = new Database(getDatabasePath());

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");

// Create Drizzle ORM instance with schema
export const db = drizzle(sqlite, { schema });

// Export types for use in other files
export type Database = typeof db;
