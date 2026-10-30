import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is missing; add it to .env.local");
}

export default defineConfig({
  casing: "snake_case",
  dbCredentials: { url },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
  strict: true,
  verbose: true,
});
