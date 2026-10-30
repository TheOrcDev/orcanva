import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { comparePositioned } from "@/lib/collab/positions";
import { getDb } from "@/lib/db/client";
import { designElements, designs } from "@/lib/db/schema";
import type { DesignRow } from "@/lib/db/schema";
import { migrateDocument } from "@/lib/document/migrate";
import type { DesignDocument } from "@/lib/document/schema";

export interface DesignSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnailKey: string | null;
  updatedAt: Date;
}

const designId = z.uuid();

export const isDesignId = (value: string): boolean =>
  designId.safeParse(value).success;

export const listDesigns = (): Promise<DesignSummary[]> =>
  getDb()
    .select({
      height: designs.height,
      id: designs.id,
      name: designs.name,
      thumbnailKey: designs.thumbnailKey,
      updatedAt: designs.updatedAt,
      width: designs.width,
    })
    .from(designs)
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
