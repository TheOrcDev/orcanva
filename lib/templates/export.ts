import { createHash } from "node:crypto";

import { coverCrop, fullPhotoSize } from "@/lib/document/crop";
import type { Size } from "@/lib/document/geometry";
import { SIZE_PRESETS, findPresetById } from "@/lib/document/presets";
import type { PresetId } from "@/lib/document/presets";
import type { DesignDocument, DesignElement } from "@/lib/document/schema";
import { templatePreviewUrl } from "@/lib/templates/assets";
import type {
  Template,
  TemplateAsset,
  TemplateSummary,
} from "@/lib/templates/schema";

// What `pnpm template:export` writes besides the template's own JSON: the
// catalog every list reads (lib/templates/catalog.ts, safe for the client)
// and the server's lazy loaders (lib/templates/documents.ts). Pure, so
// tests check the committed files against the data.

// Template images are named by their SHA-256, and their asset ids are
// UUIDv5s of it in this namespace, so a file is always the same row
const TEMPLATE_ASSET_NAMESPACE = "6f1d9a52-3c4b-4e0a-9b1e-8a7c2d5e4f30";

export const sha256Hex = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

// RFC 4122 version 5: SHA-1 of the namespace's bytes and the name
export const uuidV5 = (name: string, namespace: string): string => {
  const hash = createHash("sha1")
    .update(Buffer.from(namespace.replaceAll("-", ""), "hex"))
    .update(name, "utf-8")
    .digest();
  hash[6] = ((hash[6] ?? 0) % 16) + 0x50;
  hash[8] = ((hash[8] ?? 0) % 64) + 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const templateAssetId = (sha256: string): string =>
  uuidV5(sha256, TEMPLATE_ASSET_NAMESPACE);

// <first 16 hex digits of the SHA-256>.<extension>
export const templateImageFile = (sha256: string, extension: string): string =>
  `${sha256.slice(0, 16)}.${extension}`;

// How wide a template keeps a photo: twice the widest it's shown on the
// page (crisp on retina screens and in 2× downloads), never wider than the
// file itself
export const exportedImageWidth = (
  document: DesignDocument,
  assetId: string,
  image: Size
): number => {
  let shown = 0;
  for (const element of document.elements) {
    if (
      (element.type === "image" || element.type === "frame") &&
      element.assetId === assetId
    ) {
      const crop =
        element.crop ??
        (element.type === "frame" ? coverCrop(image, element) : null);
      shown = Math.max(shown, fullPhotoSize(element, crop).width);
    }
  }
  return Math.min(image.width, Math.ceil(shown * 2));
};

// A photo as the template ships it: the bytes of its file, and what to
// record about it
export interface ExportedImage extends Pick<
  TemplateAsset,
  "height" | "license" | "mimeType" | "name" | "source" | "width"
> {
  bytes: Uint8Array;
}

const EXTENSIONS: Record<TemplateAsset["mimeType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface TemplateMeta {
  category: string;
  id: string;
  name: string;
  presetId: PresetId;
  preview: string;
  tags: string[];
}

const renumber = (
  elements: readonly DesignElement[],
  assetIds: ReadonlyMap<string, string>
): DesignElement[] => {
  const groups = new Map<string, string>();
  return elements.map((element, index) => {
    const groupId = element.groupId
      ? (groups.get(element.groupId) ?? `group-${groups.size + 1}`)
      : null;
    if (element.groupId && groupId) {
      groups.set(element.groupId, groupId);
    }
    const renamed = { ...element, groupId, id: `el-${index + 1}` };
    if (
      (renamed.type === "image" || renamed.type === "frame") &&
      renamed.assetId
    ) {
      return { ...renamed, assetId: assetIds.get(renamed.assetId) ?? "" };
    }
    return renamed;
  });
};

// A design as a template file. Elements and groups are renumbered in
// stacking order and photos point at assets named by their content, so the
// same design (or a copy of it, whose uploads have other ids) always gives
// the same file. `images` holds each photo the design shows, by asset id.
export const designToTemplate = (
  document: DesignDocument,
  images: ReadonlyMap<string, ExportedImage>,
  meta: TemplateMeta
): { template: Template; files: Map<string, Uint8Array> } => {
  const assetIds = new Map<string, string>();
  const assets: TemplateAsset[] = [];
  const files = new Map<string, Uint8Array>();
  for (const element of document.elements) {
    if (
      (element.type === "image" || element.type === "frame") &&
      element.assetId &&
      !assetIds.has(element.assetId)
    ) {
      const image = images.get(element.assetId);
      if (!image) {
        throw new Error(`No image for asset ${element.assetId}`);
      }
      const sha256 = sha256Hex(image.bytes);
      const file = templateImageFile(sha256, EXTENSIONS[image.mimeType]);
      const id = templateAssetId(sha256);
      assetIds.set(element.assetId, id);
      if (!assets.some((asset) => asset.id === id)) {
        const { bytes, ...about } = image;
        assets.push({ ...about, bytes: bytes.length, file, id });
        files.set(file, bytes);
      }
    }
  }
  return {
    files,
    template: {
      ...meta,
      assets,
      document: {
        background: document.background,
        elements: renumber(document.elements, assetIds),
        height: document.height,
        version: document.version,
        width: document.width,
      },
    },
  };
};

const presetOrder = new Map<string, number>(
  SIZE_PRESETS.map((preset, index) => [preset.id, index])
);

export const summarizeTemplate = (template: Template): TemplateSummary => {
  const preset = findPresetById(template.presetId);
  if (!preset) {
    throw new Error(`Template ${template.id} has no preset`);
  }
  return {
    category: template.category,
    height: preset.height,
    id: template.id,
    name: template.name,
    presetId: template.presetId,
    preview: templatePreviewUrl(template.preview),
    tags: template.tags,
    width: preset.width,
  };
};

// The presets' own order, then by name
export const sortTemplates = <T extends Pick<Template, "name" | "presetId">>(
  templates: readonly T[]
): T[] =>
  templates.toSorted(
    (a, b) =>
      (presetOrder.get(a.presetId) ?? 0) - (presetOrder.get(b.presetId) ?? 0) ||
      a.name.localeCompare(b.name, "en")
  );

// Keys sorted, as the linter wants them
const sortedKeys = (_key: string, value: unknown): unknown =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).toSorted(([a], [b]) => (a < b ? -1 : 1))
      )
    : value;

const GENERATED =
  "// Generated by `pnpm template:export` from lib/templates/data; don't edit";

// A template file's text: keys sorted all the way down, since the
// database hands rows back with theirs in any order
export const templateJson = (template: Template): string =>
  `${JSON.stringify(template, sortedKeys, 2)}\n`;

export const catalogSource = (templates: readonly Template[]): string => {
  const summaries = sortTemplates(templates).map(summarizeTemplate);
  return `${GENERATED}
import type { TemplateSummary } from "@/lib/templates/schema";

export const TEMPLATES: readonly TemplateSummary[] = ${JSON.stringify(summaries, sortedKeys, 2)};
`;
};

export const documentsSource = (templates: readonly Template[]): string => {
  // By id, as the linter wants object keys
  const loaders = templates
    .toSorted((a, b) => (a.id < b.id ? -1 : 1))
    .map(
      ({ id }) =>
        `  ${JSON.stringify(id)}: () => import(${JSON.stringify(`./data/${id}.json`)}).then((file) => file.default),`
    )
    .join("\n");
  return `import "server-only";

${GENERATED}
// Each template's file, loaded only when it's used
export const TEMPLATE_FILES: Readonly<Record<string, () => Promise<unknown>>> = {
${loaders}
};
`;
};
