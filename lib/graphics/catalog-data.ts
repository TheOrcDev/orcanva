import { z } from "zod";

import { GRAPHIC_KINDS, graphicArtSchema } from "@/lib/graphics/entry";

// The catalog the Graphics tab searches, as scripts/build-graphics.ts writes
// it to public/graphics/<version>/: one index of every graphic, and the art
// split into shards that are fetched only for the results on screen.

export const CATALOG_FORMAT = 1;
export const CATALOG_ROOT = "/graphics";
export const INDEX_FILE = "index.json";
export const NOTICES_FILE = "NOTICES.txt";
export const shardFile = (shard: number) => `shards/${shard}.json`;

// [id, kind, name, keywords (space-separated), shard]
export const indexRowSchema = z.tuple([
  z.string().min(1).max(96),
  z.enum(GRAPHIC_KINDS),
  z.string().min(1).max(120),
  z.string().max(2000),
  z.number().int().min(0),
]);
export type IndexRow = z.infer<typeof indexRowSchema>;

export const catalogIndexSchema = z.object({
  format: z.literal(CATALOG_FORMAT),
  rows: z.array(indexRowSchema).max(20_000),
});
export type CatalogIndex = z.infer<typeof catalogIndexSchema>;

// Art by id; layers leave out fields at their defaults
export const shardSchema = z.record(
  z.string().min(1).max(96),
  graphicArtSchema
);
export type Shard = z.infer<typeof shardSchema>;

export const catalogUrl = (version: string, file: string) =>
  `${CATALOG_ROOT}/${version}/${file}`;
