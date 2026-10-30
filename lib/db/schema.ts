import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { DesignDocument } from "@/lib/document/schema";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const designs = pgTable(
  "designs",
  {
    ...timestamps,
    // Source of truth for content; width/height are copies for the gallery
    document: jsonb("document").$type<DesignDocument>().notNull(),
    height: integer("height").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    thumbnailKey: text("thumbnail_key"),
    width: integer("width").notNull(),
  },
  (table) => [index("designs_updated_at_idx").on(table.updatedAt)]
);

export const assetStatus = pgEnum("asset_status", ["pending", "ready"]);

export const assets = pgTable(
  "assets",
  {
    ...timestamps,
    height: integer("height").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    originalName: text("original_name").notNull(),
    sha256: text("sha256").unique(),
    sizeBytes: integer("size_bytes").notNull(),
    status: assetStatus("status").notNull().default("pending"),
    width: integer("width").notNull(),
  },
  (table) => [index("assets_created_at_idx").on(table.createdAt)]
);

export type DesignRow = typeof designs.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
