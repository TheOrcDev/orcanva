import { describe, expect, it } from "vitest";

import {
  assetKey,
  isServableKey,
  isUploadMimeType,
  thumbnailKey,
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
    expect(isServableKey("smoke-test/x.txt")).toBe(false);
    expect(isServableKey("assets/../secrets")).toBe(false);
    expect(isServableKey("/assets/abc.png")).toBe(false);
  });

  it("allowlists raster upload types only", () => {
    expect(isUploadMimeType("image/png")).toBe(true);
    expect(isUploadMimeType("image/svg+xml")).toBe(false);
    expect(isUploadMimeType("image/heic")).toBe(false);
  });
});
