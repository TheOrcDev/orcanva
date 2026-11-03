import { describe, expect, it } from "vitest";

import {
  assetKey,
  avatarKey,
  isServableKey,
  isUploadMimeType,
  ownAvatarKey,
  storageUrl,
  thumbnailKey,
  versionThumbnailKey,
} from "@/lib/storage/keys";

describe("storage keys", () => {
  it("builds asset and versioned thumbnail keys", () => {
    expect(assetKey("abc", "image/jpeg")).toBe("assets/abc.jpg");
    expect(thumbnailKey("design-1", "v1")).toBe("thumbnails/design-1/v1.jpg");
    expect(thumbnailKey("design-1")).toMatch(
      /^thumbnails\/design-1\/[0-9a-f-]{36}\.jpg$/u
    );
  });

  it("only serves known prefixes without traversal", () => {
    expect(isServableKey("assets/abc.png")).toBe(true);
    expect(isServableKey("thumbnails/d/1.jpg")).toBe(true);
    expect(isServableKey("avatars/u/1.jpg")).toBe(true);
    expect(isServableKey("versions/d/1.jpg")).toBe(true);
    expect(isServableKey("versions/../thumbnails/d/1.jpg")).toBe(false);
    expect(isServableKey("smoke-test/x.txt")).toBe(false);
    expect(isServableKey("assets/../secrets")).toBe(false);
    expect(isServableKey("/assets/abc.png")).toBe(false);
  });

  it("builds a random key per version picture, under the design", () => {
    expect(versionThumbnailKey("design-1", "v1")).toBe(
      "versions/design-1/v1.jpg"
    );
    expect(versionThumbnailKey("design-1")).toMatch(
      /^versions\/design-1\/[0-9a-f-]{36}\.jpg$/u
    );
    expect(versionThumbnailKey("design-1")).not.toBe(
      versionThumbnailKey("design-1")
    );
  });

  it("builds versioned avatar keys per account", () => {
    expect(avatarKey("user-1", "v1")).toBe("avatars/user-1/v1.jpg");
    expect(avatarKey("user-1")).toMatch(
      /^avatars\/user-1\/[0-9a-f-]{36}\.jpg$/u
    );
  });

  it("only claims avatars stored for the same account", () => {
    const own = storageUrl(avatarKey("user-1", "v1"));
    expect(ownAvatarKey(own, "user-1")).toBe("avatars/user-1/v1.jpg");
    expect(ownAvatarKey(own, "user-2")).toBeNull();
    expect(ownAvatarKey(null, "user-1")).toBeNull();
    expect(
      ownAvatarKey("https://lh3.googleusercontent.com/a/photo", "user-1")
    ).toBeNull();
    expect(ownAvatarKey(storageUrl("assets/abc.png"), "user-1")).toBeNull();
    expect(
      ownAvatarKey(storageUrl("avatars/user-1/../../assets/x"), "user-1")
    ).toBeNull();
  });

  it("allowlists raster upload types only", () => {
    expect(isUploadMimeType("image/png")).toBe(true);
    expect(isUploadMimeType("image/svg+xml")).toBe(false);
    expect(isUploadMimeType("image/heic")).toBe(false);
  });
});
