import "server-only";
import { desc, eq, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { roleFor } from "@/lib/auth/access";
import type { DesignRole } from "@/lib/auth/access";
import { comparePositioned } from "@/lib/collab/positions";
import { getDb } from "@/lib/db/client";
import { designElements, designs } from "@/lib/db/schema";
import type { DesignRow } from "@/lib/db/schema";
import { migrateDocument } from "@/lib/document/migrate";
import type { DesignDocument } from "@/lib/document/schema";

export interface DesignSummary {
  id: string;
  name: string;
  ownerId: string | null;
  width: number;
  height: number;
  thumbnailKey: string | null;
  updatedAt: Date;
}

const designId = z.uuid();

export const isDesignId = (value: string): boolean =>
  designId.safeParse(value).success;

// Designs the viewer may open: every public one, plus their own
export const visibleTo = (viewerId: string | null): SQL | undefined =>
  viewerId
    ? or(eq(designs.visibility, "public"), eq(designs.ownerId, viewerId))
    : eq(designs.visibility, "public");

export const listDesigns = (
  viewerId: string | null
): Promise<DesignSummary[]> =>
  getDb()
    .select({
      height: designs.height,
      id: designs.id,
      name: designs.name,
      ownerId: designs.ownerId,
      thumbnailKey: designs.thumbnailKey,
      updatedAt: designs.updatedAt,
      width: designs.width,
    })
    .from(designs)
    .where(visibleTo(viewerId))
    .orderBy(desc(designs.updatedAt));

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
    .select({ ownerId: designs.ownerId, visibility: designs.visibility })
    .from(designs)
    .where(eq(designs.id, id))
    .limit(1);
  return row ? roleFor(row, viewerId) : null;
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
