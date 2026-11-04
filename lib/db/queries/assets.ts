import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { isAdminSql } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import {
  assets,
  designElements,
  designVersions,
  designs,
} from "@/lib/db/schema";
import type { AssetRow } from "@/lib/db/schema";
import type { EditorAsset } from "@/lib/editor/store";
import { assetFileUrl, templateAssetRow } from "@/lib/templates/assets";
import type { TemplateAsset } from "@/lib/templates/schema";

// The same table again, for "the sources of these assets" subqueries
const lookedUp = alias(assets, "looked_up");

export const toEditorAsset = (row: AssetRow): EditorAsset => ({
  height: row.height,
  id: row.id,
  name: row.originalName,
  sourceAssetId: row.sourceAssetId,
  url: assetFileUrl(row),
  variant: row.variant,
  width: row.width,
});

// Rows for a template's images, which its photos point at (see
// templateAssetRow)
export const upsertTemplateAssets = async (
  list: readonly TemplateAsset[]
): Promise<void> => {
  if (list.length > 0) {
    await getDb()
      .insert(assets)
      .values(list.map(templateAssetRow))
      .onConflictDoNothing();
  }
};

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

// Whether anything still shows the asset: an element of any design, or a
// stored version (which a restore can bring back). Its cutouts count too,
// since deleting an asset's row deletes the cutouts made from it. Only an
// admin's Delete for everyone removes uploaded files yet, on purpose while
// they're shown (findImageFamily); any cleanup or library delete must check
// this first.
export const isAssetReferenced = async (id: string): Promise<boolean> => {
  const result = await getDb().execute<{ referenced: boolean }>(sql`
    WITH family AS (
      SELECT ${id}::uuid AS id
      UNION
      SELECT ${assets.id} FROM ${assets} WHERE ${assets.sourceAssetId} = ${id}::uuid
    )
    SELECT EXISTS (
      SELECT 1 FROM ${designElements}
      WHERE ${designElements.data}->>'assetId' IN (SELECT id::text FROM family)
    ) OR EXISTS (
      SELECT 1 FROM ${designVersions}
      WHERE ${designVersions.assetIds} && ARRAY(SELECT id FROM family)
    ) AS referenced
  `);
  return result.rows[0]?.referenced === true;
};

// An uploaded image and its whole family, for an admin to delete: the
// uploads it was made from (never template images, which ship with the
// app) and everything made from any of those, so neither Restore original
// nor another cutout brings it back. Empty unless the viewer is an admin,
// the design is public and one of its elements shows one of them
// (canDeleteImageEverywhere).
export const findImageFamily = async ({
  assetId,
  designId,
  viewerId,
}: {
  assetId: string;
  designId: string;
  viewerId: string;
}): Promise<{ id: string; key: string }[]> => {
  const result = await getDb().execute<{ id: string; key: string }>(sql`
    WITH RECURSIVE made_from AS (
      SELECT ${assets.id} AS id, ${assets.sourceAssetId} AS source_id
      FROM ${assets}
      WHERE ${assets.id} = ${assetId}::uuid AND ${assets.origin} = 'upload'
      UNION
      SELECT ${assets.id}, ${assets.sourceAssetId}
      FROM ${assets} JOIN made_from ON ${assets.id} = made_from.source_id
      WHERE ${assets.origin} = 'upload'
    ), family AS (
      SELECT id FROM made_from
      UNION
      SELECT ${assets.id}
      FROM ${assets} JOIN family ON ${assets.sourceAssetId} = family.id
    )
    SELECT ${assets.id} AS id, ${assets.key} AS key
    FROM ${assets}
    WHERE ${assets.id} IN (SELECT id FROM family)
      AND ${isAdminSql(viewerId)}
      AND EXISTS (
        SELECT 1 FROM ${designs}
        WHERE ${designs.id} = ${designId}::uuid AND ${designs.visibility} = 'public'
      )
      AND EXISTS (
        SELECT 1 FROM ${designElements}
        WHERE ${designElements.designId} = ${designId}::uuid
          AND ${designElements.data}->>'assetId' IN (SELECT id::text FROM family)
      )
  `);
  return result.rows;
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
