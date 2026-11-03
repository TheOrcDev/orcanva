import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { roleFor } from "@/lib/auth/access";
import type { DesignRole, Visibility } from "@/lib/auth/access";
import { comparePositioned } from "@/lib/collab/positions";
import { authUsers } from "@/lib/db/auth-schema";
import { getDb } from "@/lib/db/client";
import { designElements, designShares, designs } from "@/lib/db/schema";
import type { DesignRow } from "@/lib/db/schema";
import { migrateDocument } from "@/lib/document/migrate";
import type { DesignDocument } from "@/lib/document/schema";

export interface DesignSummary {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  visibility: Visibility;
  width: number;
  height: number;
  thumbnailKey: string | null;
  updatedAt: Date;
}

const designId = z.uuid();

export const isDesignId = (value: string): boolean =>
  designId.safeParse(value).success;

// The viewer's email, lowercased, only once it's proven theirs
const verifiedEmailOf = (viewerId: string): SQL =>
  sql`(SELECT lower(${authUsers.email}) FROM ${authUsers} WHERE ${authUsers.id} = ${viewerId} AND ${authUsers.emailVerified})`;

// Designs their owners shared with the viewer: invites they accepted, and
// any sent to their email once it's verified
export const sharedWith = (viewerId: string): SQL =>
  sql`${designs.id} IN (SELECT ${designShares.designId} FROM ${designShares} WHERE ${designShares.userId} = ${viewerId} OR ${designShares.email} = ${verifiedEmailOf(viewerId)})`;

// Designs the viewer may open: every public one, their own, and the ones
// shared with them. Route Handlers' raw SQL uses it too, where `designs` is
// the table itself (no alias).
export const visibleTo = (viewerId: string | null): SQL =>
  viewerId
    ? sql`(${designs.visibility} = 'public' OR ${designs.ownerId} = ${viewerId} OR ${sharedWith(viewerId)})`
    : sql`${designs.visibility} = 'public'`;

// Designs whose version history the viewer may see and restore: their own
// and the ones shared with them (canManageHistory). Unaliased `designs`, as
// in visibleTo().
export const managesHistory = (viewerId: string | null): SQL =>
  viewerId
    ? sql`(${designs.ownerId} = ${viewerId} OR ${sharedWith(viewerId)})`
    : sql`false`;

// The newest public designs shown in the gallery
const PUBLIC_GALLERY_LIMIT = 60;

const summaries = () =>
  getDb()
    .select({
      height: designs.height,
      id: designs.id,
      name: designs.name,
      ownerId: designs.ownerId,
      ownerName: authUsers.name,
      thumbnailKey: designs.thumbnailKey,
      updatedAt: designs.updatedAt,
      visibility: designs.visibility,
      width: designs.width,
    })
    .from(designs)
    .leftJoin(authUsers, eq(authUsers.id, designs.ownerId));

// The account's private designs
export const listPrivateDesigns = (ownerId: string): Promise<DesignSummary[]> =>
  summaries()
    .where(and(eq(designs.ownerId, ownerId), eq(designs.visibility, "private")))
    .orderBy(desc(designs.updatedAt));

// Other people's designs shared with the account, public or private
export const listSharedDesigns = (viewerId: string): Promise<DesignSummary[]> =>
  summaries()
    .where(and(sharedWith(viewerId), ne(designs.ownerId, viewerId)))
    .orderBy(desc(designs.updatedAt));

// Everyone's public designs (the newest ones), the viewer's own included;
// with `ownerId`, all of that account's
export const listPublicDesigns = ({
  ownerId,
}: { ownerId?: string } = {}): Promise<DesignSummary[]> => {
  const query = summaries().orderBy(desc(designs.updatedAt));
  return ownerId
    ? query.where(
        and(eq(designs.visibility, "public"), eq(designs.ownerId, ownerId))
      )
    : query.where(eq(designs.visibility, "public")).limit(PUBLIC_GALLERY_LIMIT);
};

export const getDesign = async (id: string): Promise<DesignRow | null> => {
  if (!isDesignId(id)) {
    return null;
  }
  const [row] = await getDb()
    .select()
    .from(designs)
    .where(eq(designs.id, id))
    .limit(1);
  return row ?? null;
};

// What the viewer may do with a design; null when it doesn't exist for them
export const getDesignRole = async (
  id: string,
  viewerId: string | null
): Promise<DesignRole | null> => {
  if (!isDesignId(id)) {
    return null;
  }
  const [row] = await getDb()
    .select({
      isShared: viewerId
        ? sharedWith(viewerId).mapWith(Boolean)
        : sql`false`.mapWith(Boolean),
      ownerId: designs.ownerId,
      visibility: designs.visibility,
    })
    .from(designs)
    .where(eq(designs.id, id))
    .limit(1);
  return row ? roleFor(row, viewerId, row.isShared) : null;
};

// Whether the design's owner shared it with the viewer
export const isDesignSharedWith = async (
  id: string,
  viewerId: string | null
): Promise<boolean> => {
  if (!(viewerId && isDesignId(id))) {
    return false;
  }
  const [row] = await getDb()
    .select({ id: designs.id })
    .from(designs)
    .where(and(eq(designs.id, id), sharedWith(viewerId)))
    .limit(1);
  return row !== undefined;
};

export interface DesignContent {
  row: DesignRow;
  document: DesignDocument;
  // Each element's z-order key, by element id
  positions: Record<string, string>;
}

// The design row and its element rows, assembled into a document
export const getDesignContent = async (
  id: string
): Promise<DesignContent | null> => {
  if (!isDesignId(id)) {
    return null;
  }
  const db = getDb();
  const [rows, elementRows] = await db.batch([
    db.select().from(designs).where(eq(designs.id, id)).limit(1),
    db
      .select({
        data: designElements.data,
        id: designElements.id,
        position: designElements.position,
      })
      .from(designElements)
      .where(eq(designElements.designId, id)),
  ]);
  const [row] = rows;
  if (!row) {
    return null;
  }

  const sorted = elementRows.toSorted(comparePositioned);
  const document = migrateDocument({
    background: row.background,
    elements: sorted.map((element) => element.data),
    height: row.height,
    version: row.version,
    width: row.width,
  });
  return {
    document,
    positions: Object.fromEntries(
      sorted.map((element) => [element.id, element.position])
    ),
    row,
  };
};
