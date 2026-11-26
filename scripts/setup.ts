/**
 * Creates/updates the database tables (migrations).
 *
 *   npm run db:setup            → apply migrations. Never adds data to a real database.
 *   npm run db:setup -- --seed  → also add DEMO data, only if the database has no users yet.
 *
 * With no DATABASE_URL, the local PGlite database is used and demo data is added
 * automatically when it is empty (handy for trying the app). With DATABASE_URL set
 * (Neon etc.) demo data is only added if you pass --seed.
 *
 * Migrations use DATABASE_URL_UNPOOLED when present (a direct connection, recommended by Neon).
 * Stop the dev server first when using local PGlite (only one process can open it).
 */
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { users } from "../src/lib/db/schema";

async function main() {
  const real = Boolean(process.env.DATABASE_URL);
  if (process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
  // Import after choosing the URL (the client connects on first use)
  const { db } = await import("../src/lib/db/client");

  const migrationsFolder = "./drizzle";
  if (real) {
    const host = new URL(process.env.DATABASE_URL!).hostname;
    console.log(`• Database: ${host}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePg(db as any, { migrationsFolder });
  } else {
    console.log(`• Database: local PGlite (${process.env.PGLITE_DIR || ".data/pglite"})`);
    await migratePglite(db, { migrationsFolder });
  }
  console.log("✓ Tables are up to date");

  const wantSeed = process.argv.includes("--seed") || (!real && !process.argv.includes("--no-seed"));
  if (!wantSeed) {
    if (real) console.log("• No data added.");
    return;
  }
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length) {
    console.log("• Database already has users, skipping demo data");
    return;
  }
  const { seed } = await import("./seed");
  await seed(db);
  console.log("✓ Demo data added");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
