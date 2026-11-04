// The Graphics tab's catalog (icons, emoji, stickers), read from the files
// the app serves in public/graphics rather than fetched over HTTP
import { readFile } from "node:fs/promises";
import path from "node:path";

import { findBuiltinGraphic } from "@/lib/graphics/builtin";
import {
  INDEX_FILE,
  catalogIndexSchema,
  shardFile,
  shardSchema,
} from "@/lib/graphics/catalog-data";
import type { IndexRow, Shard } from "@/lib/graphics/catalog-data";
import { CATALOG_VERSION } from "@/lib/graphics/catalog-version";
import type { GraphicEntry, GraphicKind } from "@/lib/graphics/entry";
import { prepareSearch, searchGraphics } from "@/lib/graphics/search";
import type { SearchIndex } from "@/lib/graphics/search";

const ROOT = path.resolve(
  import.meta.dirname,
  "../public/graphics",
  CATALOG_VERSION
);

interface Catalog {
  byId: Map<string, IndexRow>;
  search: SearchIndex;
}

const readJson = async (file: string): Promise<unknown> =>
  JSON.parse(await readFile(path.join(ROOT, file), "utf-8"));

let catalog: Promise<Catalog> | null = null;
const shards = new Map<number, Promise<Shard>>();

const loadCatalog = (): Promise<Catalog> => {
  catalog ??= readJson(INDEX_FILE).then((json) => {
    const index = catalogIndexSchema.parse(json);
    return {
      byId: new Map(index.rows.map((row) => [row[0], row])),
      search: prepareSearch(index),
    };
  });
  return catalog;
};

const loadShard = (number: number): Promise<Shard> => {
  let shard = shards.get(number);
  if (!shard) {
    shard = readJson(shardFile(number)).then((json) => shardSchema.parse(json));
    shards.set(number, shard);
  }
  return shard;
};

export interface GraphicHit {
  id: string;
  kind: GraphicKind;
  name: string;
}

export const findGraphics = async (
  query: string,
  kind: GraphicKind | "all",
  limit: number
): Promise<GraphicHit[]> => {
  const { search } = await loadCatalog();
  return searchGraphics(search, query, kind)
    .slice(0, limit)
    .map(([id, rowKind, name]) => ({ id, kind: rowKind, name }));
};

// A graphic by its id, or else the best match for the words given
export const resolveGraphic = async (
  idOrQuery: string
): Promise<GraphicEntry> => {
  const builtin = findBuiltinGraphic(idOrQuery);
  if (builtin) {
    return builtin;
  }
  const { byId, search } = await loadCatalog();
  const row =
    byId.get(idOrQuery) ?? searchGraphics(search, idOrQuery, "all")[0];
  if (!row) {
    throw new Error(`No graphic matches "${idOrQuery}"; try search_graphics`);
  }
  const [id, kind, name, , number] = row;
  const shard = await loadShard(number);
  const art = shard[id];
  if (!art) {
    throw new Error(`Graphic ${id} is missing its art`);
  }
  return { ...art, id, kind, name };
};
