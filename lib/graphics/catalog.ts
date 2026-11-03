import { findBuiltinGraphic } from "@/lib/graphics/builtin";
import {
  INDEX_FILE,
  catalogIndexSchema,
  catalogUrl,
  shardFile,
  shardSchema,
} from "@/lib/graphics/catalog-data";
import type {
  CatalogIndex,
  IndexRow,
  Shard,
} from "@/lib/graphics/catalog-data";
import { CATALOG_VERSION } from "@/lib/graphics/catalog-version";
import type { GraphicEntry } from "@/lib/graphics/entry";
import { prepareSearch } from "@/lib/graphics/search";
import type { SearchIndex } from "@/lib/graphics/search";

// The Graphics tab's catalog, fetched (never imported, so none of it lands
// in a bundle) the first time the tab opens, then kept for the session.
// Its files sit under a content hash and are cached for good.

export interface Catalog {
  rows: IndexRow[];
  byId: Map<string, IndexRow>;
  search: SearchIndex;
}

// Throws on anything that isn't a catalog this code can read
export const parseCatalogIndex = (json: unknown): CatalogIndex =>
  catalogIndexSchema.parse(json);

const fetchJson = async (file: string): Promise<unknown> => {
  const response = await fetch(catalogUrl(CATALOG_VERSION, file));
  if (!response.ok) {
    throw new Error(`Couldn't load graphics (${response.status})`);
  }
  return response.json();
};

let catalog: Promise<Catalog> | null = null;
const shards = new Map<number, Promise<Shard>>();
// Art already fetched, for code that can't wait (a drop)
const loaded = new Map<string, GraphicEntry>();

const fetchCatalog = async (): Promise<Catalog> => {
  try {
    const index = parseCatalogIndex(await fetchJson(INDEX_FILE));
    return {
      byId: new Map(index.rows.map((row) => [row[0], row])),
      rows: index.rows,
      search: prepareSearch(index),
    };
  } catch (error) {
    // Let the next open try again
    catalog = null;
    throw error;
  }
};

export const loadCatalog = (): Promise<Catalog> => {
  catalog ??= fetchCatalog();
  return catalog;
};

const fetchShard = async (number: number): Promise<Shard> => {
  try {
    return shardSchema.parse(await fetchJson(shardFile(number)));
  } catch (error) {
    shards.delete(number);
    throw error;
  }
};

const loadShard = (number: number): Promise<Shard> => {
  let shard = shards.get(number);
  if (!shard) {
    shard = fetchShard(number);
    shards.set(number, shard);
  }
  return shard;
};

// The graphics for some index rows, in the same order; rows whose art is
// missing from their shard are left out
export const loadEntries = async (
  rows: readonly IndexRow[]
): Promise<GraphicEntry[]> => {
  const numbers = [...new Set(rows.map((row) => row[4]))];
  const fetched = new Map(
    await Promise.all(
      numbers.map(async (number) => [number, await loadShard(number)] as const)
    )
  );
  return rows.flatMap(([id, kind, name, , number]) => {
    const art = fetched.get(number)?.[id];
    if (!art) {
      return [];
    }
    const entry: GraphicEntry = { ...art, id, kind, name };
    loaded.set(id, entry);
    return [entry];
  });
};

// A graphic by id, built in or from the catalog; null when it's gone (a
// newer catalog renamed it)
export const findGraphic = async (id: string): Promise<GraphicEntry | null> => {
  const builtin = findBuiltinGraphic(id);
  if (builtin) {
    return builtin;
  }
  const known = loaded.get(id);
  if (known) {
    return known;
  }
  const { byId } = await loadCatalog();
  const row = byId.get(id);
  if (!row) {
    return null;
  }
  const [entry] = await loadEntries([row]);
  return entry ?? null;
};

// The credits link: both MIT licences in full
export const noticesUrl = () => catalogUrl(CATALOG_VERSION, "NOTICES.txt");
