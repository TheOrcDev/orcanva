import { pgSchema, text, uuid } from "drizzle-orm/pg-core";

// Neon Auth's own tables, read-only from here (owner names in the gallery).
// Kept out of lib/db/schema.ts so drizzle-kit never tries to create them.
const neonAuth = pgSchema("neon_auth");

export const authUsers = neonAuth.table("user", {
  id: uuid("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
});
