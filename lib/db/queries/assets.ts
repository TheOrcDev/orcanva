import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db/client";
import { assets, designElements } from "@/lib/db/schema";
import type { AssetRow } from "@/lib/db/schema";
import type { EditorAsset } from "@/lib/editor/store";
import { assetFileUrl } from "@/lib/templates/assets";

// The same table again, for "the sources of these assets" subqueries
const lookedUp = alias(assets, "looked_up");

export const toEditorAsset = (row: AssetRow): EditorAsset => ({
  height: row.height,
  id: row.id,
  name: row.originalName,
  sourceAssetId: row.sourceAssetId,
  url: assetFileUrl(row),
  width: row.width,
});

// An account's uploads library, newest first: only its own uploads, never
// template images (which have no owner)
export const listLibrary = async (ownerId: string): Promise<EditorAsset[]> => {
  const rows = await getDb()
    .select()
    .from(assets)
    .where(and(eq(assets.ownerId, ownerId), eq(assets.status, "ready")))
    .orderBy(desc(assets.createdAt));
  return rows.map(toEditorAsset);
};

// Everything a design's images and frames show, whoever uploaded it, plus
// the originals behind its cutouts ("Restore original")
export const listDesignAssets = async (
  designId: string
): Promise<EditorAsset[]> => {
  const db = getDb();
  const used = db
    .select({ id: sql<string>`(${designElements.data}->>'assetId')::uuid` })
    .from(designElements)
    .where(
      and(
        eq(designElements.designId, designId),
        sql`${designElements.data}->>'type' IN ('image', 'frame')`,
        sql`${designElements.data}->>'assetId' IS NOT NULL`
      )
    );
  const rows = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.status, "ready"),
        or(
          inArray(assets.id, used),
          inArray(
            assets.id,
            db
              .select({ id: lookedUp.sourceAssetId })
              .from(lookedUp)
              .where(inArray(lookedUp.id, used))
          )
        )
      )
    );
  return rows.map(toEditorAsset);
};

// Ready assets by id, plus the originals behind any cutouts among them
export const findReadyAssets = async (
  ids: readonly string[]
): Promise<EditorAsset[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.status, "ready"),
        or(
          inArray(assets.id, [...ids]),
          inArray(
            assets.id,
            db
              .select({ id: lookedUp.sourceAssetId })
              .from(lookedUp)
              .where(inArray(lookedUp.id, [...ids]))
          )
        )
      )
    );
  return rows.map(toEditorAsset);
};
