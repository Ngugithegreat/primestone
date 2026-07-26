import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Production database client.
 *
 * Targets any standard Postgres (Neon, Supabase, RDS…) via a `DATABASE_URL`
 * connection string. The connection is created lazily on first use so that a
 * build with no database configured still succeeds — only code paths that
 * actually touch the database require the env var.
 *
 * The service functions in `src/server/*` take a `db` argument rather than
 * importing this singleton, which keeps them testable against an embedded
 * Postgres (see `scripts/verify-backend.ts`).
 */
export type Database = PostgresJsDatabase<typeof schema>;

let _db: Database | null = null;
let _client: postgres.Sql | null = null;

export function getDb(): Database {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Postgres connection string to the " +
        "environment (Vercel → Settings → Environment Variables) before using " +
        "the database.",
    );
  }

  // `prepare: false` is required when connecting through a transaction pooler
  // such as Neon's or Supabase's PgBouncer in transaction mode.
  _client = postgres(url, { prepare: false });
  _db = drizzle(_client, { schema });
  return _db;
}

export { schema };
