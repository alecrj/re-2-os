import type { Config } from "drizzle-kit";

const isTurso = process.env.DATABASE_URL?.startsWith("libsql://");

export default {
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dialect: isTurso ? "turso" : "sqlite",
  dbCredentials: isTurso
    ? {
        url: process.env.DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : {
        url: process.env.DATABASE_URL || "file:./data/reselleros.db",
      },
} satisfies Config;
