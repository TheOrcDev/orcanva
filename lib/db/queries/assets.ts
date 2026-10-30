import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import type { AssetRow } from "@/lib/db/schema";
import type { EditorAsset } from "@/lib/editor/store";
import { storageUrl } from "@/lib/storage/keys";

export const toEditorAsset = (row: AssetRow): EditorAsset => ({
  height: row.height,
  id: row.id,
  name: row.originalName,
  sourceAssetId: row.sourceAssetId,
  url: storageUrl(row.key),
  width: row.width,
});

export const listReadyAssets = async (): Promise<EditorAsset[]> => {
  const rows = await getDb()
    .select()
    .from(assets)
    .where(eq(assets.status, "ready"))
    .orderBy(desc(assets.createdAt));
  return rows.map(toEditorAsset);
};

const lookedUp = alias(assets, "looked_up");

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
