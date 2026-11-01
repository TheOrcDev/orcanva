import { boolean, pgSchema, text, uuid } from "drizzle-orm/pg-core";

// Neon Auth's own tables, read-only from here (owner names in the gallery,
// who a design is shared with). Kept out of lib/db/schema.ts so drizzle-kit
// never tries to create them.
const neonAuth = pgSchema("neon_auth");

export const authUsers = neonAuth.table("user", {
  email: text("email").notNull(),
  // Google sign-ins are; email sign-ups aren't (nothing asks them to be)
  emailVerified: boolean("emailVerified").notNull(),
  id: uuid("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
});
