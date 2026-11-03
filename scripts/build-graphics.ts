// Builds the Graphics tab's catalog into public/graphics/<hash>/ and points
// lib/graphics/catalog-version.ts at it. The output is committed, so builds
// need no network and changes show up in review.
//
// Usage:
//   pnpm graphics:build                       rebuild from the sources here
//   pnpm graphics:build --fluent <checkout>   also redraw the emoji from a
//     checkout of github.com/microsoft/fluentui-emoji (its flat SVGs and
//     metadata.json files are enough); the files are only read, never run
//
// Sources: Tabler Icons from node_modules/@tabler/icons (MIT), our own
// stickers (CC0: lib/graphics/builtin.ts and assets/graphics/stickers/),
// and Fluent Emoji Flat (MIT). The emoji's names, keywords and upstream
// commit live in assets/graphics/fluent-flat/metadata.json; their SVGs
// aren't kept here, to keep the repo small, so without --fluent the emoji
// art carries over from the current catalog unchanged. Redraw them from a
// checkout at that commit after changing lib/graphics/normalize.ts.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { z } from "zod";

import type { GraphicLayer } from "@/lib/document/schema";
import { BUILTIN_GRAPHICS } from "@/lib/graphics/builtin";
import {
  CATALOG_FORMAT,
  INDEX_FILE,
  NOTICES_FILE,
  catalogIndexSchema,
  shardFile,
  shardSchema,
} from "@/lib/graphics/catalog-data";
import type {
  CatalogIndex,
  IndexRow,
  Shard,
} from "@/lib/graphics/catalog-data";
import { MAX_GRAPHIC_JSON_LENGTH } from "@/lib/graphics/entry";
import type { GraphicArt, GraphicKind } from "@/lib/graphics/entry";
import { UnsupportedSvgError, normalizeSvg } from "@/lib/graphics/normalize";

const ROOT = path.resolve(import.meta.dirname, "..");
const TABLER = path.join(ROOT, "node_modules/@tabler/icons");
const FLUENT = path.join(ROOT, "assets/graphics/fluent-flat");
const FLUENT_METADATA = path.join(FLUENT, "metadata.json");
const STICKERS = path.join(ROOT, "assets/graphics/stickers");
const OUTPUT = path.join(ROOT, "public/graphics");
const VERSION_FILE = path.join(ROOT, "lib/graphics/catalog-version.ts");

// What currentColor paints in Tabler's icons: the editor's default ink
const ICON_INK = "#111111";
// Uncompressed bytes per shard; about 80 shards for the whole catalog
const SHARD_TARGET_BYTES = 72_000;
// Never more than this from one source file
const MAX_SOURCE_BYTES = 256_000;

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

interface Candidate {
  id: string;
  kind: GraphicKind;
  name: string;
  keywords: string[];
  load: () => GraphicArt;
}

interface Built extends Omit<Candidate, "load"> {
  art: GraphicArt;
}

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const keywordsOf = (...parts: (string | string[])[]): string[] => [
  ...new Set(parts.flat().flatMap(words)),
];

const humanize = (slug: string) => {
  const text = slug.replaceAll("-", " ").trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

const slugOf = (text: string) =>
  text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

const refuseCarried = (reason: string): never => {
  throw new UnsupportedSvgError(reason);
};

const readSource = (file: string): string => {
  if (statSync(file).size > MAX_SOURCE_BYTES) {
    throw new UnsupportedSvgError("a file too big to read");
  }
  return readFileSync(file, "utf-8");
};

// ---- Fluent Emoji: names and keywords from a checkout

const EMOJI_GROUPS = [
  "Smileys & Emotion",
  "People & Body",
  "Animals & Nature",
  "Food & Drink",
  "Travel & Places",
  "Activities",
  "Objects",
  "Symbols",
  "Flags",
];

const fluentMetadataSchema = z.object({
  cldr: z.string().min(1).max(120),
  glyph: z.string().min(1).max(32),
  group: z.string().max(60).default(""),
  keywords: z.array(z.string().max(80)).max(60).default([]),
  unicode: z.string().max(80).default(""),
});

const fluentEntrySchema = z.object({
  glyph: z.string(),
  group: z.string(),
  keywords: z.array(z.string()),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/u),
  // The flat SVG's path in the upstream repository
  source: z.string().regex(/^assets\/[^.][^\0]*\.svg$/u),
  unicode: z.string(),
});
type FluentEntry = z.infer<typeof fluentEntrySchema>;

const fluentSourcesSchema = z.object({
  commit: z.string(),
  emoji: z.array(fluentEntrySchema),
  repository: z.string(),
});

const unicodeOrder = (unicode: string) =>
  unicode.split(/\s+/u).map((part) => Number.parseInt(part, 16) || 0);

const compareEmoji = (a: FluentEntry, b: FluentEntry) => {
  const group = (entry: FluentEntry) => {
    const index = EMOJI_GROUPS.indexOf(entry.group);
    return index === -1 ? EMOJI_GROUPS.length : index;
  };
  if (group(a) !== group(b)) {
    return group(a) - group(b);
  }
  const [first, second] = [unicodeOrder(a.unicode), unicodeOrder(b.unicode)];
  for (
    let index = 0;
    index < Math.max(first.length, second.length);
    index += 1
  ) {
    const difference = (first[index] ?? -1) - (second[index] ?? -1);
    if (difference !== 0) {
      return difference;
    }
  }
  return a.name.localeCompare(b.name);
};

// The commit a checkout is at, read from its .git files
const checkoutCommit = (checkout: string): string => {
  const gitDir = path.join(checkout, ".git");
  const head = readFileSync(path.join(gitDir, "HEAD"), "utf-8").trim();
  if (!head.startsWith("ref: ")) {
    return head;
  }
  const ref = head.slice("ref: ".length);
  const loose = path.join(gitDir, ref);
  if (existsSync(loose)) {
    return readFileSync(loose, "utf-8").trim();
  }
  const packed = readFileSync(path.join(gitDir, "packed-refs"), "utf-8");
  return (
    packed
      .split("\n")
      .find((line) => line.endsWith(` ${ref}`))
      ?.split(" ")[0] ?? "unknown"
  );
};

// The flat SVG of an emoji folder; emoji with skin tones keep theirs under
// Default/
const flatSvgOf = (folder: string): string | null => {
  for (const dir of [
    path.join(folder, "Flat"),
    path.join(folder, "Default/Flat"),
  ]) {
    if (existsSync(dir)) {
      const svg = readdirSync(dir).find((file) => file.endsWith(".svg"));
      if (svg) {
        return path.join(dir, svg);
      }
    }
  }
  return null;
};

// Every emoji in the checkout, in emoji order; nothing is copied but names
const importFluent = (checkout: string) => {
  const assets = path.join(checkout, "assets");
  if (!existsSync(assets)) {
    throw new Error(`No assets/ folder in ${checkout}`);
  }
  const emoji: FluentEntry[] = [];
  const slugs = new Set<string>();
  let skipped = 0;
  for (const folderName of readdirSync(assets).toSorted()) {
    const folder = path.join(assets, folderName);
    const metadataFile = path.join(folder, "metadata.json");
    const svg = flatSvgOf(folder);
    const metadata =
      svg && existsSync(metadataFile)
        ? fluentMetadataSchema.safeParse(JSON.parse(readSource(metadataFile)))
        : null;
    if (!(svg && metadata?.success)) {
      skipped += 1;
      continue;
    }
    let slug = slugOf(folderName);
    if (slugs.has(slug)) {
      slug = `${slug}-${slugOf(metadata.data.unicode)}`;
    }
    slugs.add(slug);
    emoji.push({
      glyph: metadata.data.glyph,
      group: metadata.data.group,
      keywords: metadata.data.keywords,
      name: humanize(metadata.data.cldr),
      slug,
      source: path.relative(checkout, svg).split(path.sep).join("/"),
      unicode: metadata.data.unicode,
    });
  }
  const commit = checkoutCommit(checkout);
  mkdirSync(FLUENT, { recursive: true });
  // One emoji per line, so a refresh reads well in review
  const lines = emoji
    .toSorted(compareEmoji)
    .map((entry) => `  ${JSON.stringify(entry)}`);
  writeFileSync(
    FLUENT_METADATA,
    `{"commit": ${JSON.stringify(commit)}, "repository": "https://github.com/microsoft/fluentui-emoji", "emoji": [\n${lines.join(",\n")}\n]}\n`
  );
  writeFileSync(
    path.join(FLUENT, "LICENSE"),
    readSource(path.join(checkout, "LICENSE"))
  );
  log(`Read ${emoji.length} emoji (skipped ${skipped}) at ${commit}`);
};

// ---- The catalog this build replaces, for art that carries over

const previousVersion = (): string | null => {
  if (!existsSync(VERSION_FILE)) {
    return null;
  }
  const match = /CATALOG_VERSION = "(?<version>[0-9a-f]+)"/u.exec(
    readFileSync(VERSION_FILE, "utf-8")
  );
  return match?.groups?.version ?? null;
};

// Reads art from the current catalog, a shard at a time
class PreviousCatalog {
  readonly #dir: string | null;
  readonly #shardOf = new Map<string, number>();
  readonly #shards = new Map<number, Shard>();

  constructor() {
    const version = previousVersion();
    const dir = version ? path.join(OUTPUT, version) : null;
    this.#dir = dir && existsSync(path.join(dir, INDEX_FILE)) ? dir : null;
    if (!this.#dir) {
      return;
    }
    const index = catalogIndexSchema.parse(
      JSON.parse(readFileSync(path.join(this.#dir, INDEX_FILE), "utf-8"))
    );
    for (const row of index.rows) {
      this.#shardOf.set(row[0], row[4]);
    }
  }

  art(id: string): GraphicArt | null {
    const number = this.#shardOf.get(id);
    if (!this.#dir || number === undefined) {
      return null;
    }
    let shard = this.#shards.get(number);
    if (!shard) {
      shard = shardSchema.parse(
        JSON.parse(
          readFileSync(path.join(this.#dir, shardFile(number)), "utf-8")
        )
      );
      this.#shards.set(number, shard);
    }
    return shard[id] ?? null;
  }
}

// ---- Sources

const tablerMetadataSchema = z.record(
  z.string(),
  z.object({
    category: z.string().default(""),
    name: z.string(),
    styles: z.record(z.string(), z.unknown()),
    tags: z.array(z.union([z.string(), z.number(), z.null()])).default([]),
  })
);

const tablerCandidates = (): Candidate[] => {
  const metadata = tablerMetadataSchema.parse(
    JSON.parse(readFileSync(path.join(TABLER, "icons.json"), "utf-8"))
  );
  const candidates: Candidate[] = [];
  for (const icon of Object.values(metadata)) {
    const tags = icon.tags.flatMap((tag) => (tag === null ? [] : String(tag)));
    for (const style of ["outline", "filled"] as const) {
      const file = path.join(TABLER, "icons", style, `${icon.name}.svg`);
      if (!(style in icon.styles && existsSync(file))) {
        continue;
      }
      const filled = style === "filled";
      candidates.push({
        id: filled ? `tabler:${icon.name}-filled` : `tabler:${icon.name}`,
        keywords: keywordsOf(
          icon.name,
          tags,
          icon.category,
          filled ? "filled solid" : "outline line"
        ),
        kind: "icon",
        load: () => normalizeSvg(readSource(file), { currentColor: ICON_INK }),
        name: filled ? `${humanize(icon.name)} (filled)` : humanize(icon.name),
      });
    }
  }
  return candidates;
};

const fluentCandidates = (checkout: string | null): Candidate[] => {
  if (!existsSync(FLUENT_METADATA)) {
    log("No Fluent Emoji yet: run with --fluent <checkout>");
    return [];
  }
  const sources = fluentSourcesSchema.parse(
    JSON.parse(readFileSync(FLUENT_METADATA, "utf-8"))
  );
  const previous = checkout ? null : new PreviousCatalog();
  return sources.emoji.map((emoji) => {
    const id = `fluent:${emoji.slug}`;
    return {
      id,
      keywords: [
        ...keywordsOf(emoji.name, emoji.keywords, emoji.group),
        emoji.glyph,
      ],
      kind: "emoji",
      load: () => {
        if (checkout) {
          return normalizeSvg(readSource(path.join(checkout, emoji.source)), {
            currentColor: ICON_INK,
          });
        }
        return (
          previous?.art(id) ??
          refuseCarried(`left out last time too (redraw with --fluent)`)
        );
      },
      name: emoji.name,
    };
  });
};

const stickerSourcesSchema = z.array(
  z.object({
    file: z.string().regex(/^[a-z0-9-]+\.svg$/u),
    keywords: z.array(z.string()).min(1),
    name: z.string().min(1).max(120),
  })
);

const stickerCandidates = (): Candidate[] => {
  const builtin: Candidate[] = BUILTIN_GRAPHICS.map((graphic) => ({
    id: graphic.id,
    keywords: keywordsOf(graphic.keywords, graphic.name),
    kind: "sticker",
    load: () => graphic,
    name: graphic.name,
  }));
  const listFile = path.join(STICKERS, "stickers.json");
  if (!existsSync(listFile)) {
    return builtin;
  }
  const stickers = stickerSourcesSchema.parse(
    JSON.parse(readFileSync(listFile, "utf-8"))
  );
  return [
    ...builtin,
    ...stickers.map((sticker): Candidate => ({
      id: `sticker:${sticker.file.replace(/\.svg$/u, "")}`,
      keywords: keywordsOf(sticker.keywords, sticker.name),
      kind: "sticker",
      load: () =>
        normalizeSvg(readSource(path.join(STICKERS, sticker.file)), {
          currentColor: ICON_INK,
        }),
      name: sticker.name,
    })),
  ];
};

// ---- Output

// Layer fields at their schema defaults are left out of the shards
const LAYER_DEFAULTS: Partial<GraphicLayer> = {
  fillRule: "nonzero",
  lineCap: "butt",
  lineJoin: "miter",
  opacity: 1,
  stroke: null,
  strokeWidth: 0,
};

// Keys sorted, so carried-over art writes exactly as it was read
const compactArt = (art: GraphicArt) => ({
  layers: art.layers.map((layer) =>
    Object.fromEntries(
      Object.entries(layer)
        .filter(
          ([key, value]) =>
            !(key in LAYER_DEFAULTS) ||
            LAYER_DEFAULTS[key as keyof GraphicLayer] !== value
        )
        .toSorted(([first], [second]) => first.localeCompare(second))
    )
  ),
  palette: art.palette,
  viewBox: art.viewBox,
});

const build = (candidates: Candidate[]) => {
  const built: Built[] = [];
  const refused = new Map<string, string[]>();
  const ids = new Set<string>();
  const refuseEntry = (reason: string, id: string) => {
    refused.set(reason, [...(refused.get(reason) ?? []), id]);
  };
  for (const { load, ...candidate } of candidates) {
    if (ids.has(candidate.id)) {
      throw new Error(`Two graphics share the id ${candidate.id}`);
    }
    ids.add(candidate.id);
    try {
      const art = load();
      const entry = { ...candidate, art };
      if (JSON.stringify(entry).length > MAX_GRAPHIC_JSON_LENGTH) {
        refuseEntry("bigger than an element may carry", candidate.id);
        continue;
      }
      built.push(entry);
    } catch (error) {
      if (!(error instanceof UnsupportedSvgError)) {
        throw error;
      }
      refuseEntry(error.message, candidate.id);
    }
  }
  return { built, refused };
};

// Fills shards kind by kind, in index order, up to the target size
const shardsOf = (built: Built[]) => {
  const shards: Shard[] = [];
  const rows: IndexRow[] = [];
  let current: Shard = {};
  let bytes = 0;
  for (const entry of built) {
    const art = compactArt(entry.art);
    const size = JSON.stringify(art).length + entry.id.length;
    if (
      Object.keys(current).length > 0 &&
      (bytes + size > SHARD_TARGET_BYTES || rows.at(-1)?.[1] !== entry.kind)
    ) {
      shards.push(current);
      current = {};
      bytes = 0;
    }
    current[entry.id] = art as GraphicArt;
    bytes += size;
    rows.push([
      entry.id,
      entry.kind,
      entry.name,
      entry.keywords.join(" "),
      shards.length,
    ]);
  }
  if (Object.keys(current).length > 0) {
    shards.push(current);
  }
  return { rows, shards };
};

const notices = () =>
  [
    "Graphics in Orcanva's Graphics tab",
    "",
    "Icons: Tabler Icons, https://tabler.io/icons (MIT)",
    "Emoji: Microsoft Fluent Emoji, flat style, https://github.com/microsoft/fluentui-emoji (MIT)",
    "Stickers: Orcanva's own artwork, released under CC0 1.0 (public domain dedication)",
    "",
    "Designs made with them need no credit line.",
    "",
    "==== Tabler Icons ====",
    "",
    readFileSync(path.join(TABLER, "LICENSE"), "utf-8").trim(),
    "",
    "==== Microsoft Fluent Emoji ====",
    "",
    readFileSync(path.join(FLUENT, "LICENSE"), "utf-8").trim(),
    "",
  ].join("\n");

const write = (built: Built[]) => {
  const { rows, shards } = shardsOf(built);
  const index: CatalogIndex = { format: CATALOG_FORMAT, rows };
  const files = new Map<string, string>([
    [INDEX_FILE, JSON.stringify(index)],
    [NOTICES_FILE, notices()],
    ...shards.map(
      (shard, number) => [shardFile(number), JSON.stringify(shard)] as const
    ),
  ]);
  const hash = createHash("sha256");
  for (const [name, content] of files) {
    hash.update(name).update("\0").update(content).update("\0");
  }
  const version = hash.digest("hex").slice(0, 12);
  rmSync(OUTPUT, { force: true, recursive: true });
  for (const [name, content] of files) {
    const file = path.join(OUTPUT, version, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  writeFileSync(
    VERSION_FILE,
    [
      "// Written by scripts/build-graphics.ts (pnpm graphics:build): the",
      "// catalog in public/graphics/ that the Graphics tab fetches",
      `export const CATALOG_VERSION = "${version}";`,
      "",
    ].join("\n")
  );
  let raw = 0;
  let gzipped = 0;
  for (const content of files.values()) {
    raw += Buffer.byteLength(content);
    gzipped += gzipSync(content).length;
  }
  const indexBytes = gzipSync(files.get(INDEX_FILE) ?? "").length;
  log(
    `Wrote ${rows.length} graphics in ${shards.length} shards to public/graphics/${version}/`
  );
  log(
    `  ${(raw / 1e6).toFixed(2)} MB (${(gzipped / 1e6).toFixed(2)} MB gzipped), index ${(indexBytes / 1e3).toFixed(0)} KB gzipped`
  );
};

const main = () => {
  const fluentFlag = process.argv.indexOf("--fluent");
  const checkoutArgument =
    fluentFlag === -1 ? null : process.argv[fluentFlag + 1];
  if (checkoutArgument === undefined) {
    throw new Error("Usage: pnpm graphics:build --fluent <checkout>");
  }
  const checkout = checkoutArgument ? path.resolve(checkoutArgument) : null;
  if (checkout) {
    importFluent(checkout);
  }
  const candidates = [
    ...stickerCandidates(),
    ...fluentCandidates(checkout),
    ...tablerCandidates(),
  ];
  const { built, refused } = build(candidates);
  for (const kind of ["sticker", "emoji", "icon"] as const) {
    const count = built.filter((entry) => entry.kind === kind).length;
    log(`${kind}: ${count}`);
  }
  for (const [reason, refusedIds] of refused) {
    log(
      `Left out ${refusedIds.length} (${reason}): ${refusedIds.slice(0, 6).join(", ")}${refusedIds.length > 6 ? ", …" : ""}`
    );
  }
  write(built);
};

main();
