import {
  index,
  integer,
  uniqueIndex,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
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

// Private: only the owner can open it. Public: listed in the gallery, and
// anyone, signed in or not, can edit the canvas.
export const designVisibility = pgEnum("design_visibility", [
  "private",
  "public",
]);

// owner_id columns reference neon_auth."user"(id). That table belongs to
// Neon Auth, so the foreign keys live in hand-written SQL (drizzle/0006_*)
// rather than here, where drizzle-kit would try to create the table.
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
    // Who can rename, delete and change visibility; null only for designs
    // made before accounts existed
    ownerId: uuid("owner_id"),
    thumbnailKey: text("thumbnail_key"),
    // Document schema version the elements were written with
    version: integer("version").notNull().default(1),
    // Public by default while instances without accounts may still insert
    visibility: designVisibility("visibility").notNull().default("public"),
    width: integer("width").notNull(),
  },
  (table) => [
    index("designs_updated_at_idx").on(table.updatedAt),
    index("designs_owner_updated_idx").on(table.ownerId, table.updatedAt),
    index("designs_visibility_updated_idx").on(
      table.visibility,
      table.updatedAt
    ),
  ]
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

// Who is on a design right now, one row per open editor session: where
// their pointer is, what they have selected and what they're dragging. Read
// by a live query, so others see it about as fast as it's written.
export const designPresence = pgTable(
  "design_presence",
  {
    clientId: uuid("client_id").notNull(),
    color: text("color").notNull(),
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    drag: jsonb("drag"),
    // Avatar of a signed-in person; guests have none
    image: text("image"),
    name: text("name").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
    selection: jsonb("selection").$type<string[]>().notNull().default([]),
    // The signed-in person behind the session; null for guests
    userId: uuid("user_id"),
    // Pointer in page coordinates; null while it's off the canvas
    x: real("x"),
    y: real("y"),
  },
  (table) => [primaryKey({ columns: [table.designId, table.clientId] })]
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
    // The uploader's account and whose library it's in; null for uploads
    // made by guests, which are in nobody's library
    ownerId: uuid("owner_id"),
    // Computed by the browser and never verified, so only ever matched
    // within one account's own uploads
    sha256: text("sha256"),
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
    index("assets_owner_created_idx").on(table.ownerId, table.createdAt),
    // One copy of a file per account. Guests (null owner) never collide.
    uniqueIndex("assets_owner_sha256_idx").on(table.ownerId, table.sha256),
    // One cached result per account, source image and variant
    uniqueIndex("assets_owner_source_variant_idx").on(
      table.ownerId,
      table.sourceAssetId,
      table.variant
    ),
  ]
);

export type DesignRow = typeof designs.$inferSelect;
export type DesignElementRow = typeof designElements.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
