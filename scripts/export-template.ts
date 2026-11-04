// Turns a design into a starter template: lib/templates/data/<id>.json, its
// photos in public/template-files/images and its preview in
// public/template-files/previews, then rewrites the catalog and runs the
// template checks. Exporting needs the database and the bucket, so it runs
// here, from .env.local.
//
// Usage:
//   pnpm template:export <design id> --id <template id> --category <name>
//     [--name <name>] [--preset <size preset id>] [--tags a,b,c]
//     [--preview <png or jpg>] [--source <where the photos came from>]
//     [--license <their licence>]
//   pnpm template:export --catalog   only rewrite the catalog from the data
//
// The design's name, size preset and tags carry over from the template it
// replaces unless given again. The preview is the --preview file, made to
// fit 800 px, or else the design's gallery thumbnail. Photos are re-encoded
// as WebP at twice the size they're shown at most; template photos that are
// small enough already stay as they are, so they keep their ids. Uploads
// need --source and --license: only your own photos or CC0 ones.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { config } from "dotenv";
import sharp from "sharp";

import { migrateDocument } from "@/lib/document/migrate";
import { PRESET_IDS, findPresetBySize } from "@/lib/document/presets";
import type { PresetId } from "@/lib/document/presets";
import type { DesignDocument } from "@/lib/document/schema";
import { TEMPLATE_IMAGES_PREFIX } from "@/lib/templates/assets";
import {
  catalogSource,
  designToTemplate,
  documentsSource,
  exportedImageWidth,
  sha256Hex,
  templateJson,
} from "@/lib/templates/export";
import type { ExportedImage } from "@/lib/templates/export";
import {
  TEMPLATE_MIME_TYPES,
  templateIdSchema,
  templateSchema,
} from "@/lib/templates/schema";
import type { Template, TemplateAsset } from "@/lib/templates/schema";

config({ path: ".env.local", quiet: true });

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "lib/templates/data");
const IMAGES = path.join(ROOT, "public/template-files/images");
const PREVIEWS = path.join(ROOT, "public/template-files/previews");
const CATALOG = path.join(ROOT, "lib/templates/catalog.ts");
const DOCUMENTS = path.join(ROOT, "lib/templates/documents.ts");

const PREVIEW_MAX_SIZE = 800;
const PREVIEW_QUALITY = 82;
const PHOTO_QUALITY = 84;

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing; add it to .env.local`);
  }
  return value;
};

const readTemplates = (): Template[] =>
  existsSync(DATA)
    ? readdirSync(DATA)
        .filter((name) => name.endsWith(".json"))
        .map((name) =>
          templateSchema.parse(
            JSON.parse(readFileSync(path.join(DATA, name), "utf-8"))
          )
        )
    : [];

// The catalog and loaders from the data, formatted; then the checks
const writeCatalog = (written: string[] = []) => {
  const templates = readTemplates();
  writeFileSync(CATALOG, catalogSource(templates));
  writeFileSync(DOCUMENTS, documentsSource(templates));
  // Files no template uses any more
  const used = new Set(
    templates.flatMap((template) => [
      template.preview,
      ...template.assets.map((asset) => asset.file),
    ])
  );
  for (const folder of [IMAGES, PREVIEWS]) {
    for (const name of existsSync(folder) ? readdirSync(folder) : []) {
      if (!(name.startsWith(".") || used.has(name))) {
        rmSync(path.join(folder, name));
        log(`Removed ${path.relative(ROOT, path.join(folder, name))}`);
      }
    }
  }
  execFileSync("pnpm", ["exec", "oxfmt", CATALOG, DOCUMENTS, ...written], {
    cwd: ROOT,
    stdio: "inherit",
  });
  execFileSync("pnpm", ["exec", "vitest", "run", "lib/templates"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  log(`${templates.length} templates in the catalog`);
};

const isMimeType = (value: string): value is TemplateAsset["mimeType"] =>
  (TEMPLATE_MIME_TYPES as readonly string[]).includes(value);

const isPresetId = (value: string): value is PresetId =>
  (PRESET_IDS as readonly string[]).includes(value);

type Flags = Record<string, string | undefined>;
type Download = (key: string) => Promise<Uint8Array>;
type Sql = NeonQueryFunction<false, false>;

const storage = (): Download => {
  const s3 = new S3Client({
    credentials: {
      accessKeyId: required("AWS_ACCESS_KEY_ID"),
      secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
    },
    endpoint: required("AWS_ENDPOINT_URL_S3"),
    forcePathStyle: true,
    region: required("AWS_REGION"),
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return async (key) => {
    const object = await s3.send(
      new GetObjectCommand({ Bucket: required("STORAGE_BUCKET"), Key: key })
    );
    if (!object.Body) {
      throw new Error(`Nothing stored at ${key}`);
    }
    return object.Body.transformToByteArray();
  };
};

// Raw SQL: the app's queries are server-only modules. Templates are one
// page, so a design with more is refused.
const loadDesign = async (sql: Sql, designId: string) => {
  const [design] = await sql`
    SELECT name, width, height, background, version, thumbnail_key
    FROM designs WHERE id = ${designId}`;
  if (!design) {
    throw new Error(`No design ${designId}`);
  }
  const pages = await sql`
    SELECT id, background FROM design_pages WHERE design_id = ${designId}`;
  if (pages.length > 1) {
    throw new Error(
      "A template is one page: copy the page you want into a design of its own"
    );
  }
  const rows = await sql`
    SELECT data FROM design_elements WHERE design_id = ${designId}
    ORDER BY position COLLATE "C", id COLLATE "C"`;
  const document = migrateDocument({
    background: pages[0]?.background ?? design.background,
    elements: rows.map((row) => row.data),
    height: design.height,
    version: design.version,
    width: design.width,
  });
  return {
    document,
    name: String(design.name),
    thumbnailKey: design.thumbnail_key as string | null,
  };
};

const presetOf = (
  document: DesignDocument,
  flags: Flags,
  previous: Template | undefined
): PresetId => {
  const preset = findPresetBySize(document.width, document.height);
  const presetId = flags.preset ?? preset?.id ?? previous?.presetId;
  if (!(presetId && isPresetId(presetId))) {
    throw new Error("Pass --preset: the design's size isn't a preset's");
  }
  if (preset?.id !== presetId) {
    throw new Error(`The design isn't ${presetId}'s size; resize it first`);
  }
  return presetId;
};

// One photo as the template will ship it. Template photos small enough
// already keep their bytes, and so their ids.
const exportImage = async ({
  assetId,
  document,
  download,
  flags,
  known,
  row,
}: {
  assetId: string;
  document: DesignDocument;
  download: Download;
  flags: Flags;
  known: ReadonlyMap<string, TemplateAsset>;
  row: Record<string, unknown>;
}): Promise<ExportedImage> => {
  const key = String(row.key);
  const mimeType = String(row.mime_type);
  const size = { height: Number(row.height), width: Number(row.width) };
  const fromTemplate = row.origin === "template";
  const original = fromTemplate
    ? new Uint8Array(
        readFileSync(
          path.join(IMAGES, key.slice(TEMPLATE_IMAGES_PREFIX.length))
        )
      )
    : await download(key);
  const width = exportedImageWidth(document, assetId, size);
  const kept = fromTemplate && width >= size.width && isMimeType(mimeType);
  const bytes = kept
    ? original
    : new Uint8Array(
        await sharp(original)
          .resize({ width, withoutEnlargement: true })
          .webp({ effort: 6, quality: PHOTO_QUALITY })
          .toBuffer()
      );
  const encoded = await sharp(bytes).metadata();
  const about = known.get(assetId);
  const source = about?.source ?? flags.source;
  const license = about?.license ?? flags.license;
  if (!(source && license)) {
    throw new Error(
      "Pass --source and --license for the design's uploads (your own photos or CC0 ones)"
    );
  }
  return {
    bytes,
    height: encoded.height,
    license,
    mimeType: kept && isMimeType(mimeType) ? mimeType : "image/webp",
    name: about?.name ?? String(row.original_name).slice(0, 200),
    source,
    width: encoded.width,
  };
};

const exportImages = async (
  sql: Sql,
  document: DesignDocument,
  download: Download,
  flags: Flags
): Promise<Map<string, ExportedImage>> => {
  const assetIds = [
    ...new Set(
      document.elements.flatMap((element) =>
        (element.type === "image" || element.type === "frame") &&
        element.assetId
          ? [element.assetId]
          : []
      )
    ),
  ];
  if (assetIds.length === 0) {
    return new Map();
  }
  const rows = await sql`
    SELECT id, key, mime_type, original_name, width, height, origin
    FROM assets WHERE id = ANY(${assetIds}::uuid[])`;
  const known = new Map(
    readTemplates().flatMap((template) =>
      template.assets.map((asset) => [asset.id, asset] as const)
    )
  );
  const images = await Promise.all(
    assetIds.map((assetId) => {
      const row = rows.find((candidate) => candidate.id === assetId);
      if (!row) {
        throw new Error(`Photo ${assetId} has no asset row`);
      }
      return exportImage({ assetId, document, download, flags, known, row });
    })
  );
  return new Map(assetIds.map((assetId, index) => [assetId, images[index]]));
};

// The --preview file, or else the design's gallery thumbnail, as WebP
const exportPreview = async (
  flags: Flags,
  thumbnailKey: string | null,
  download: Download
): Promise<Buffer> => {
  let source: Uint8Array | null = null;
  if (flags.preview) {
    source = readFileSync(path.resolve(flags.preview));
  } else if (thumbnailKey) {
    source = await download(thumbnailKey);
  }
  if (!source) {
    throw new Error(
      "The design has no thumbnail yet: open it in the editor, or pass --preview"
    );
  }
  return sharp(source)
    .resize({
      fit: "inside",
      height: PREVIEW_MAX_SIZE,
      width: PREVIEW_MAX_SIZE,
      withoutEnlargement: true,
    })
    .webp({ effort: 6, quality: PREVIEW_QUALITY })
    .toBuffer();
};

const tagsFrom = (flags: Flags, previous: Template | undefined): string[] =>
  flags.tags === undefined
    ? (previous?.tags ?? [])
    : flags.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

const exportDesign = async (designId: string, flags: Flags) => {
  const id = templateIdSchema.parse(flags.id);
  const previous = readTemplates().find((template) => template.id === id);
  const sql = neon(required("DATABASE_URL"));
  const download = storage();

  const design = await loadDesign(sql, designId);
  const { document } = design;
  const presetId = presetOf(document, flags, previous);
  const category = flags.category ?? previous?.category;
  if (!category) {
    throw new Error("Pass --category");
  }
  const images = await exportImages(sql, document, download, flags);
  const preview = await exportPreview(flags, design.thumbnailKey, download);
  const previewFile = `${id}.${sha256Hex(preview).slice(0, 8)}.webp`;

  const { files, template } = designToTemplate(document, images, {
    category,
    id,
    name: flags.name ?? previous?.name ?? design.name,
    presetId,
    preview: previewFile,
    tags: tagsFrom(flags, previous),
  });
  templateSchema.parse(template);

  mkdirSync(IMAGES, { recursive: true });
  mkdirSync(PREVIEWS, { recursive: true });
  mkdirSync(DATA, { recursive: true });
  for (const [file, bytes] of files) {
    writeFileSync(path.join(IMAGES, file), bytes);
  }
  writeFileSync(path.join(PREVIEWS, previewFile), preview);
  const json = path.join(DATA, `${id}.json`);
  writeFileSync(json, templateJson(template));
  log(`Wrote ${path.relative(ROOT, json)} with ${files.size} photos`);
  writeCatalog([json]);
};

const main = async () => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      catalog: { type: "boolean" },
      category: { type: "string" },
      id: { type: "string" },
      license: { type: "string" },
      name: { type: "string" },
      preset: { type: "string" },
      preview: { type: "string" },
      source: { type: "string" },
      tags: { type: "string" },
    },
  });
  if (values.catalog) {
    writeCatalog();
    return;
  }
  const [designId] = positionals;
  if (!(designId && values.id)) {
    throw new Error(
      "Usage: pnpm template:export <design id> --id <template id> --category <name> [--tags a,b] [--preview file]"
    );
  }
  const { catalog: _catalog, ...flags } = values;
  await exportDesign(designId, flags);
};

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}
