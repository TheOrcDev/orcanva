// Applies the Drizzle migrations in ./drizzle, like `pnpm db:migrate`, but
// with no drizzle-kit: the Docker image bundles this file and runs it before
// the server starts. Migrations already applied are skipped, so running it
// again is safe. Usage: node migrate.mjs (DATABASE_URL in the environment)
//
// Over a WebSocket, not HTTP: this migrator applies every pending migration
// in one transaction, so a failed one leaves the database as it was. The
// neon-http one runs each statement on its own and records them at the end.
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is missing");
}

const pool = new Pool({ connectionString: url });
try {
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: process.env.MIGRATIONS_FOLDER ?? "./drizzle",
  });
  process.stdout.write("Migrations applied\n");
} finally {
  await pool.end();
}
