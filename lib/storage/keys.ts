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
export const AVATAR_PREFIX = "avatars/";
export const VERSION_PREFIX = "versions/";

export const assetKey = (assetId: string, mimeType: UploadMimeType): string =>
  `${ASSET_PREFIX}${assetId}.${UPLOAD_MIME_TYPES[mimeType]}`;

// A new random key per save: immutable, so safely cacheable, and not
// guessable from the design id (storage URLs are capabilities)
export const thumbnailKey = (
  designId: string,
  version: string = crypto.randomUUID()
): string => `${THUMBNAIL_PREFIX}${designId}/${version}.jpg`;

// Version history pictures, one random key each, under the design's id.
// Never shown in the public gallery, so a design going private leaves them.
export const versionThumbnailKey = (
  designId: string,
  version: string = crypto.randomUUID()
): string => `${VERSION_PREFIX}${designId}/${version}.jpg`;

// Profile pictures: a new random key per upload, under the account's id
export const avatarKey = (
  userId: string,
  version: string = crypto.randomUUID()
): string => `${AVATAR_PREFIX}${userId}/${version}.jpg`;

const SAFE_KEY = /^[a-z0-9][a-z0-9/._-]*$/iu;

export const isServableKey = (key: string): boolean =>
  SAFE_KEY.test(key) &&
  !key.includes("..") &&
  (key.startsWith(ASSET_PREFIX) ||
    key.startsWith(THUMBNAIL_PREFIX) ||
    key.startsWith(AVATAR_PREFIX) ||
    key.startsWith(VERSION_PREFIX));

export const storageUrl = (key: string): string => `/api/storage/${key}`;

// Whether `image` points at a profile picture stored by this app
export const isStoredAvatarUrl = (image: string): boolean =>
  image.startsWith(storageUrl(AVATAR_PREFIX)) &&
  isServableKey(image.slice(storageUrl("").length));

// The key behind a profile picture this app stored for `userId`, or null
// for anything else (no picture, or one from Google), which isn't ours to
// delete
export const ownAvatarKey = (
  image: string | null,
  userId: string
): string | null => {
  const prefix = storageUrl(`${AVATAR_PREFIX}${userId}/`);
  if (!image?.startsWith(prefix)) {
    return null;
  }
  const key = image.slice(storageUrl("").length);
  return isServableKey(key) ? key : null;
};
