import {
  index,
  integer,
  uniqueIndex,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

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

// Derived images (e.g. a background-removed cutout) point at their source
export const assetVariant = pgEnum("asset_variant", ["no-background"]);

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
    sourceAssetId: uuid("source_asset_id").references(
      (): AnyPgColumn => assets.id,
      { onDelete: "cascade" }
    ),
    status: assetStatus("status").notNull().default("pending"),
    variant: assetVariant("variant"),
    width: integer("width").notNull(),
  },
  (table) => [
    index("assets_created_at_idx").on(table.createdAt),
    // One cached result per source image and variant
    uniqueIndex("assets_source_variant_idx").on(
      table.sourceAssetId,
      table.variant
    ),
  ]
);

export type DesignRow = typeof designs.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
