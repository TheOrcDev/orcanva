"use server";

import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";

import { requireViewer } from "@/lib/auth/server";
import {
  BRAND_KIT_LIMITS,
  addRefusal,
  brandKitItem,
} from "@/lib/brand-kit/schema";
import type { BrandKit, BrandKitItem } from "@/lib/brand-kit/schema";
import { getDb } from "@/lib/db/client";
import { brandKitFromRows, selectBrandKit } from "@/lib/db/queries/brand-kit";
import { assets, brandKitItems } from "@/lib/db/schema";

// The brand kit belongs to the signed-in account: each action checks the
// session itself (Server Actions are public endpoints) and touches only
// that account's rows. None of them call refresh(): from the editor that
// would load the whole design again. They return the kit instead.

export interface BrandKitResult {
  kit: BrandKit;
  // Why the kit didn't change, for the person; null when it did
  error: string | null;
}

// One statement, since the neon-http client has no interactive
// transactions: it only inserts while the account is under the limit for
// that kind (two tabs adding at the same moment may pass it by one), and
// an item already in the kit stays as it is. A logo is selected from the
// account's own ready uploads, which checks ownership in the same go.
const insertItem = (ownerId: string, item: BrandKitItem) => {
  const underLimit = sql`(SELECT count(*) FROM ${brandKitItems} WHERE ${brandKitItems.ownerId} = ${ownerId} AND ${brandKitItems.kind} = ${item.kind}) < ${BRAND_KIT_LIMITS[item.kind]}`;
  if (item.kind === "logo") {
    return sql`INSERT INTO ${brandKitItems} (owner_id, kind, value, asset_id)
      SELECT ${assets.ownerId}, 'logo'::brand_kit_item_kind, ${assets.id}::text, ${assets.id}
      FROM ${assets}
      WHERE ${assets.id} = ${item.value} AND ${assets.ownerId} = ${ownerId}
        AND ${assets.status} = 'ready' AND ${underLimit}
      ON CONFLICT (owner_id, kind, value) DO NOTHING`;
  }
  return sql`INSERT INTO ${brandKitItems} (owner_id, kind, value)
    SELECT ${ownerId}::uuid, ${item.kind}::brand_kit_item_kind, ${item.value}
    WHERE ${underLimit}
    ON CONFLICT (owner_id, kind, value) DO NOTHING`;
};

// Adds a colour (any hex, stored lowercase), a catalog font or one of the
// account's uploads as a logo
export const addBrandKitItem = async (
  input: z.input<typeof brandKitItem>
): Promise<BrandKitResult> => {
  const item = brandKitItem.parse(input);
  const viewer = await requireViewer();
  const db = getDb();
  const [, rows] = await db.batch([
    db.execute(insertItem(viewer.id, item)),
    selectBrandKit(db, viewer.id),
  ]);
  const kit = brandKitFromRows(rows);
  return { error: addRefusal(kit, item), kit };
};

export const removeBrandKitItem = async (
  input: z.input<typeof brandKitItem>
): Promise<BrandKitResult> => {
  const item = brandKitItem.parse(input);
  const viewer = await requireViewer();
  const db = getDb();
  const [, rows] = await db.batch([
    db
      .delete(brandKitItems)
      .where(
        and(
          eq(brandKitItems.ownerId, viewer.id),
          eq(brandKitItems.kind, item.kind),
          eq(brandKitItems.value, item.value)
        )
      ),
    selectBrandKit(db, viewer.id),
  ]);
  return { error: null, kit: brandKitFromRows(rows) };
};
