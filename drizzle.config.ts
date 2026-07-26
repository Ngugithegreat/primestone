import type { Config } from "drizzle-kit";

/**
 * drizzle-kit config.
 *   npm run db:generate  — generate SQL migrations from src/db/schema.ts
 *   npm run db:migrate   — apply pending migrations to DATABASE_URL
 *   npm run db:studio    — open a browser DB explorer
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/placeholder",
  },
  strict: true,
} satisfies Config;
