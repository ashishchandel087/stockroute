/**
 * Database connection.
 * - DATABASE_URL set  → real PostgreSQL (Neon / Supabase / any Postgres) via node-postgres.
 * - DATABASE_URL unset → PGlite: embedded Postgres stored in ./.data/pglite (local development).
 *
 * Both expose the same Drizzle API, so app code doesn't care which one is used.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = PgliteDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Local database folder (override with PGLITE_DIR, e.g. for a throwaway test database). */
export const PGLITE_DIR = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");

/**
 * Node tries each server address for only 250 ms before giving up on it. From India to a
 * US data centre the TCP handshake takes longer, so every attempt was cut off and the
 * connection timed out. Allow 2.5 s per address instead.
 */
net.setDefaultAutoSelectFamilyAttemptTimeout(2500);

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (url) {
    // sslmode=require already means full certificate checks in node-postgres; say so explicitly
    // (silences its deprecation warning, same security).
    const connectionString = url.replace(/sslmode=require\b/, "sslmode=verify-full");
    const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 30_000 });
    pool.on("error", (e) => console.error("Postgres pool error:", e.message));
    // Same query-builder surface; typed as the PGlite flavour for simplicity.
    return drizzlePg(pool, { schema, casing: "snake_case" }) as unknown as DB;
  }
  fs.mkdirSync(path.dirname(PGLITE_DIR), { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  // PGlite must be closed cleanly; a hard kill mid-write can damage the local data
  // folder (fix with `npm run db:reset`). Close it when the server is stopped.
  let closing = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (closing) return;
    closing = true;
    client
      .close()
      .catch(() => {})
      .finally(() => process.kill(process.pid, signal));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return drizzlePglite(client, { schema, casing: "snake_case" });
}

// One connection, reused across hot reloads, opened on first use (not at import time,
// so `next build` never opens the local database).
const g = globalThis as unknown as { __db?: DB };
function getDb(): DB {
  return g.__db ?? (g.__db = createDb());
}
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export { schema };
