import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import { kitFromItems } from "@/lib/brand-kit/schema";
import type { BrandKit } from "@/lib/brand-kit/schema";
import { getDb } from "@/lib/db/client";
import { toEditorAsset } from "@/lib/db/queries/assets";
import { assets, brandKitItems } from "@/lib/db/schema";

// An account's kit rows, oldest first, with each logo's upload when it's
// ready. Built separately so actions can batch it after their write.
export const selectBrandKit = (db: NeonHttpDatabase, ownerId: string) =>
  db
    .select({
      asset: assets,
      kind: brandKitItems.kind,
      value: brandKitItems.value,
    })
    .from(brandKitItems)
    .leftJoin(
      assets,
      and(eq(assets.id, brandKitItems.assetId), eq(assets.status, "ready"))
    )
    .where(eq(brandKitItems.ownerId, ownerId))
    .orderBy(asc(brandKitItems.createdAt), asc(brandKitItems.id));

export type BrandKitRows = Awaited<ReturnType<typeof selectBrandKit>>;

export const brandKitFromRows = (rows: BrandKitRows): BrandKit =>
  kitFromItems(
    rows.map((row) => ({
      kind: row.kind,
      logo: row.asset ? toEditorAsset(row.asset) : null,
      value: row.value,
    }))
  );

export const getBrandKit = async (ownerId: string): Promise<BrandKit> =>
  brandKitFromRows(await selectBrandKit(getDb(), ownerId));
