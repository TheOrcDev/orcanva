import {
  index,
  integer,
  uniqueIndex,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type {
  Background,
  DesignDocument,
  DesignElement,
} from "@/lib/document/schema";

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
    // Page settings; the elements live one per row in design_elements
    background: jsonb("background").$type<Background>(),
    // Legacy whole-document blob, replaced by design_elements
    document: jsonb("document").$type<DesignDocument>(),
    height: integer("height").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    thumbnailKey: text("thumbnail_key"),
    // Document schema version the elements were written with
    version: integer("version").notNull().default(1),
    width: integer("width").notNull(),
  },
  (table) => [index("designs_updated_at_idx").on(table.updatedAt)]
);

// One row per element, so people editing different elements never clash.
// position is a fractional index: sorting by (position, id) gives z-order.
export const designElements = pgTable(
  "design_elements",
  {
    data: jsonb("data").$type<DesignElement>().notNull(),
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    position: text("position").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // The editor session (not a user) that wrote the row last
    updatedBy: uuid("updated_by"),
  },
  (table) => [primaryKey({ columns: [table.designId, table.id] })]
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
export type DesignElementRow = typeof designElements.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
