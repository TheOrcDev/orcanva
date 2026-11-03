import { sql } from "drizzle-orm";
import {
  check,
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
import { VERSION_KINDS } from "@/lib/versions/schema";
import type { VersionElement } from "@/lib/versions/schema";

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
    // When the newest version history snapshot was due; null before the
    // first (see the changes route)
    lastVersionAt: timestamp("last_version_at", { withTimezone: true }),
    // Who wrote last: "u:<user id>" for accounts, "c:<client id>" for a
    // guest's editor session
    lastWriter: text("last_writer"),
    name: text("name").notNull(),
    // Who can rename, delete and change visibility; null only for designs
    // made before accounts existed
    ownerId: uuid("owner_id"),
    // Goes up with every restore, so open editors know to drop their undo
    // history
    restoreSeq: integer("restore_seq").notNull().default(0),
    // Who restored a version last (the live page query shows it to everyone
    // on the design)
    restoredByName: text("restored_by_name"),
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

export const designVersionKind = pgEnum("design_version_kind", VERSION_KINDS);

// Version history: a design's page and element rows as they were at one
// moment, kept whole in jsonb so taking one is a single INSERT … SELECT
// inside the save statement and restoring one a single statement too.
export const designVersions = pgTable(
  "design_versions",
  {
    // Images and frames' photos in it, so assets still shown by an old
    // version are never treated as unused
    assetIds: uuid("asset_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    background: jsonb("background").$type<Background>().notNull(),
    // When it was taken. Auto versions show the design as it was before the
    // edits of the person who caused them (see the changes route).
    contentAt: timestamp("content_at", { withTimezone: true }).notNull(),
    createdAt: timestamps.createdAt,
    // The account behind it; null for guests and deleted accounts.
    // References neon_auth."user"(id) in drizzle/0012_*, like owner_id.
    createdBy: uuid("created_by"),
    // Their name then, or the name a guest edits under
    createdByName: text("created_by_name").notNull(),
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    // DOCUMENT_VERSION the elements were written with
    docVersion: integer("doc_version").notNull(),
    elementCount: integer("element_count").notNull(),
    // Compressed with lz4 (drizzle/0012_*)
    elements: jsonb("elements").$type<VersionElement[]>().notNull(),
    height: integer("height").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    kind: designVersionKind("kind").notNull(),
    // Named versions only
    name: text("name"),
    // Restore versions: the version that was restored over this one
    restoredFromId: uuid("restored_from_id").references(
      (): AnyPgColumn => designVersions.id,
      { onDelete: "set null" }
    ),
    // octet_length of the elements as text, for the per-design budget
    sizeBytes: integer("size_bytes").notNull(),
    thumbnailKey: text("thumbnail_key"),
    width: integer("width").notNull(),
  },
  (table) => [
    index("design_versions_design_created_idx").on(
      table.designId,
      table.createdAt
    ),
    index("design_versions_asset_ids_idx").using("gin", table.assetIds),
  ]
);

// Comments pinned to a design. A thread is its root comment (thread_id
// null), which holds the pin; replies point at it. One table, so the live
// query that streams them stays a single-table SELECT. Stored outside the
// elements and versions, so a version restore never touches them.
export const designComments = pgTable(
  "design_comments",
  {
    // A root's pin on its element (element_id), in the element's own
    // unrotated frame at the size it had then (anchor_width, and
    // anchor_height for boxes), so it follows the element when it's moved,
    // turned or resized. See lib/comments/anchor.ts.
    anchorHeight: real("anchor_height"),
    anchorWidth: real("anchor_width"),
    anchorX: real("anchor_x"),
    anchorY: real("anchor_y"),
    // The account that wrote it; references neon_auth."user"(id) ON DELETE
    // SET NULL in drizzle/0013_*, like owner_id
    authorId: uuid("author_id"),
    // Copied from the account when it was written, so the live query needs
    // no join (and a rename doesn't reach old comments, as with presence)
    authorImage: text("author_image"),
    authorName: text("author_name").notNull(),
    // Plain text; mentions are <@user id> tokens
    body: text("body").notNull(),
    createdAt: timestamps.createdAt,
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    elementId: text("element_id"),
    id: uuid("id").primaryKey().defaultRandom(),
    // The names of the people its tokens mention, by user id, as they were
    // when it was written (like author_name)
    mentions: jsonb("mentions")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    // The page it's on; null is the first page, whose id will be the
    // design's own once designs have pages (plan 10)
    pageId: text("page_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    // References neon_auth."user"(id) ON DELETE SET NULL in drizzle/0013_*
    resolvedBy: uuid("resolved_by"),
    // The thread it replies to; null for a thread's root
    threadId: uuid("thread_id").references(
      (): AnyPgColumn => designComments.id,
      { onDelete: "cascade" }
    ),
    // Where a root's pin points on the page, and where it stays when its
    // element is gone
    x: real("x"),
    y: real("y"),
  },
  (table) => [
    index("design_comments_design_idx").on(table.designId, table.createdAt),
    index("design_comments_thread_idx").on(table.threadId),
    // The per-account rate limit counts recent comments
    index("design_comments_author_created_idx").on(
      table.authorId,
      table.createdAt
    ),
    // Roots carry the pin, replies don't
    check(
      "design_comments_root_pin",
      sql`(${table.threadId} IS NULL) = (${table.x} IS NOT NULL AND ${table.y} IS NOT NULL)`
    ),
  ]
);

// Who a comment mentions, one row per person: what the mention emails are
// counted and limited by, and room for an inbox later
export const commentMentions = pgTable(
  "comment_mentions",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => designComments.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    // When the email went out; null when it was skipped (no email set up,
    // a limit, or they were on the design at the time)
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    // References neon_auth."user"(id) ON DELETE CASCADE in drizzle/0013_*
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId] }),
    index("comment_mentions_user_emailed_idx").on(
      table.userId,
      table.emailedAt
    ),
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
export type DesignVersionRow = typeof designVersions.$inferSelect;
export type DesignCommentRow = typeof designComments.$inferSelect;
