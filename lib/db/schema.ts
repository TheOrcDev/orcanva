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

import { BRAND_KIT_KINDS } from "@/lib/brand-kit/schema";
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

// People a design's owner shared it with, by email. They edit it like
// anyone on a public design, whatever its visibility. An account gets in
// when its email is verified and matches, or once it accepts the emailed
// invite: the link's token shows the inbox is theirs, which matters because
// email sign-ups aren't verified.
export const designShares = pgTable(
  "design_shares",
  {
    createdAt: timestamps.createdAt,
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    // Lowercased
    email: text("email").notNull(),
    // When the invite was last emailed, for the owner's hourly limit
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // SHA-256 of the invite link's token; sending the invite again replaces
    // it, so only the newest link works
    tokenHash: text("token_hash").notNull().unique(),
    // The account that accepted the invite; references neon_auth."user"(id)
    // in drizzle/0008_*, like owner_id
    userId: uuid("user_id"),
  },
  (table) => [
    primaryKey({ columns: [table.designId, table.email] }),
    index("design_shares_user_idx").on(table.userId),
    index("design_shares_email_idx").on(table.email),
  ]
);

export const assetStatus = pgEnum("asset_status", ["pending", "ready"]);

// Derived images (e.g. a background-removed cutout) point at their source
export const assetVariant = pgEnum("asset_variant", ["no-background"]);

// Uploads are files in the bucket; template images ship with the app in
// public/template-files and have rows so photos can point at them
export const assetOrigin = pgEnum("asset_origin", ["upload", "template"]);

export const assets = pgTable(
  "assets",
  {
    ...timestamps,
    height: integer("height").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    // Where the file lives (see assetOrigin): uploads in the bucket under
    // `key`, template images at /<key>
    origin: assetOrigin("origin").notNull().default("upload"),
    originalName: text("original_name").notNull(),
    // The uploader's account and whose library it's in; null for uploads
    // made by guests and for template images, which are in nobody's library
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

export const brandKitItemKind = pgEnum("brand_kit_item_kind", BRAND_KIT_KINDS);

// An account's brand kit: colours, fonts and logos offered wherever it
// picks a colour, a font or an image. One row per item, like
// design_elements, so two tabs adding at once can't overwrite each other.
export const brandKitItems = pgTable(
  "brand_kit_items",
  {
    // Logos only: the upload it shows, which takes the logo with it
    assetId: uuid("asset_id").references(() => assets.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamps.createdAt,
    id: uuid("id").primaryKey().defaultRandom(),
    kind: brandKitItemKind("kind").notNull(),
    // References neon_auth."user"(id) in drizzle/0009_*, like owner_id on
    // designs
    ownerId: uuid("owner_id").notNull(),
    // Lowercase hex, a catalog font id, or the logo's asset id
    value: text("value").notNull(),
  },
  (table) => [
    uniqueIndex("brand_kit_items_owner_kind_value_idx").on(
      table.ownerId,
      table.kind,
      table.value
    ),
    index("brand_kit_items_owner_created_idx").on(
      table.ownerId,
      table.createdAt
    ),
  ]
);

export type DesignRow = typeof designs.$inferSelect;
export type DesignElementRow = typeof designElements.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
export type DesignShareRow = typeof designShares.$inferSelect;
export type BrandKitItemRow = typeof brandKitItems.$inferSelect;
