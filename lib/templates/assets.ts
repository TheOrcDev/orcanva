import type { assets } from "@/lib/db/schema";
import type { EditorAsset } from "@/lib/editor/store";
import { storageUrl } from "@/lib/storage/keys";
import type { TemplateAsset } from "@/lib/templates/schema";

// Template files are served from public/template-files, outside the proxy,
// with immutable caching (next.config.ts): their names come from their
// content, so a changed file is a new URL
export const TEMPLATE_FILES_PATH = "/template-files";
export const TEMPLATE_IMAGES_PREFIX = "template-files/images/";

export const templatePreviewUrl = (file: string): string =>
  `${TEMPLATE_FILES_PATH}/previews/${file}`;

export const templateImageKey = (file: string): string =>
  `${TEMPLATE_IMAGES_PREFIX}${file}`;

// Where an asset row's file is served: an upload through the storage
// route, a template image straight from public/
export const assetFileUrl = ({
  key,
  origin,
}: {
  key: string;
  origin: "upload" | "template";
}): string => (origin === "template" ? `/${key}` : storageUrl(key));

// A template image's assets row: ready, in nobody's library. Written with
// ON CONFLICT DO NOTHING whenever a template is used, since photos (and the
// cutouts Remove background makes of them) point at it by id.
export const templateAssetRow = (
  asset: TemplateAsset
): typeof assets.$inferInsert => ({
  height: asset.height,
  id: asset.id,
  key: templateImageKey(asset.file),
  mimeType: asset.mimeType,
  origin: "template",
  originalName: asset.name,
  ownerId: null,
  sha256: null,
  sizeBytes: asset.bytes,
  status: "ready",
  width: asset.width,
});

// What the editor draws a template image from
export const templateEditorAsset = (asset: TemplateAsset): EditorAsset => ({
  height: asset.height,
  id: asset.id,
  name: asset.name,
  sourceAssetId: null,
  url: assetFileUrl({ key: templateImageKey(asset.file), origin: "template" }),
  width: asset.width,
});
