import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  INDEX_FILE,
  NOTICES_FILE,
  catalogIndexSchema,
  shardFile,
  shardSchema,
} from "@/lib/graphics/catalog-data";
import { CATALOG_VERSION } from "@/lib/graphics/catalog-version";
import { MAX_GRAPHIC_JSON_LENGTH } from "@/lib/graphics/entry";

// The catalog pnpm graphics:build committed, as the Graphics tab fetches it
const DIR = path.join(import.meta.dirname, "../../public/graphics");
const read = (file: string) =>
  readFileSync(path.join(DIR, CATALOG_VERSION, file), "utf-8");

describe("the committed graphics catalog", () => {
  const index = catalogIndexSchema.parse(JSON.parse(read(INDEX_FILE)));

  it("is the only version in public/graphics", () => {
    expect(readdirSync(DIR)).toEqual([CATALOG_VERSION]);
  });

  it("has every kind, under unique ids", () => {
    const ids = index.rows.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    const kinds = new Set(index.rows.map(([, kind]) => kind));
    expect([...kinds].toSorted()).toEqual(["emoji", "icon", "sticker"]);
  });

  it("has a shard that parses for every row, holding its art", () => {
    const shardNumbers = new Set(index.rows.map((row) => row[4]));
    const shards = new Map(
      [...shardNumbers].map((number) => [
        number,
        shardSchema.parse(JSON.parse(read(shardFile(number)))),
      ])
    );
    for (const row of index.rows) {
      const [id] = row;
      const art = shards.get(row[4])?.[id];
      expect(art, id).toBeDefined();
      expect(JSON.stringify(art).length, id).toBeLessThan(
        MAX_GRAPHIC_JSON_LENGTH
      );
    }
    const shardFiles = readdirSync(
      path.join(DIR, CATALOG_VERSION, "shards")
    ).length;
    expect(shardFiles).toBe(shards.size);
  });

  it("ships the licence texts", () => {
    expect(existsSync(path.join(DIR, CATALOG_VERSION, NOTICES_FILE))).toBe(
      true
    );
    const notices = read(NOTICES_FILE);
    expect(notices).toContain("Tabler");
    expect(notices).toContain("Microsoft");
    expect(notices.match(/MIT License/gu)?.length).toBe(2);
  });
});
