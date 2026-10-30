import "server-only";
import { desc, eq } from "drizzle-orm";

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
