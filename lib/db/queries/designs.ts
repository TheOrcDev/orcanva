import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { designs } from "@/lib/db/schema";
import type { DesignRow } from "@/lib/db/schema";

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
