export const UPLOAD_MIME_TYPES = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type UploadMimeType = keyof typeof UPLOAD_MIME_TYPES;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const isUploadMimeType = (value: string): value is UploadMimeType =>
  Object.hasOwn(UPLOAD_MIME_TYPES, value);

export const ASSET_PREFIX = "assets/";
export const THUMBNAIL_PREFIX = "thumbnails/";

export const assetKey = (assetId: string, mimeType: UploadMimeType): string =>
  `${ASSET_PREFIX}${assetId}.${UPLOAD_MIME_TYPES[mimeType]}`;

// A new random key per save: immutable, so safely cacheable, and not
// guessable from the design id (storage URLs are capabilities)
export const thumbnailKey = (
  designId: string,
  version: string = crypto.randomUUID()
): string => `${THUMBNAIL_PREFIX}${designId}/${version}.jpg`;

const SAFE_KEY = /^[a-z0-9][a-z0-9/._-]*$/iu;

export const isServableKey = (key: string): boolean =>
  SAFE_KEY.test(key) &&
  !key.includes("..") &&
  (key.startsWith(ASSET_PREFIX) || key.startsWith(THUMBNAIL_PREFIX));

export const storageUrl = (key: string): string => `/api/storage/${key}`;
