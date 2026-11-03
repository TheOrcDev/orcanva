import { describe, expect, it } from "vitest";

import type { AssetVariant } from "@/lib/assets/variants";
import { isReusableVariant } from "@/lib/assets/variants";
import {
  assetChain,
  findVariant,
  hasVariant,
  originalAssetId,
} from "@/lib/editor/asset-variants";
import type { EditorAsset } from "@/lib/editor/store";

const asset = (
  id: string,
  source: string | null = null,
  variant: AssetVariant | null = null
): EditorAsset => ({
  height: 100,
  id,
  name: id,
  sourceAssetId: source,
  url: `/api/storage/assets/${id}.png`,
  variant,
  width: 100,
});

// An upload, cut out, then the cutout upscaled
const CHAIN = [
  asset("upload"),
  asset("cutout", "upload", "no-background"),
  asset("big", "cutout", "upscaled-4x"),
];

describe("assetChain", () => {
  it("walks from a copy back to its upload", () => {
    expect(assetChain(CHAIN, "big")).toEqual(["big", "cutout", "upload"]);
  });

  it("lists a source this editor hasn't loaded, then stops", () => {
    expect(assetChain([asset("erased", "upload", "erased")], "erased")).toEqual(
      ["erased", "upload"]
    );
  });

  it("stops at a loop", () => {
    const loop = [asset("a", "b", "erased"), asset("b", "a", "erased")];
    expect(assetChain(loop, "a")).toEqual(["a", "b"]);
  });

  it("is just the id for an unknown asset", () => {
    expect(assetChain([], "missing")).toEqual(["missing"]);
  });
});

describe("originalAssetId", () => {
  it("goes back to the first original, past every copy", () => {
    expect(originalAssetId(CHAIN, "big")).toBe("upload");
    expect(originalAssetId(CHAIN, "upload")).toBe("upload");
  });
});

describe("hasVariant", () => {
  it("finds a cutout anywhere up the chain", () => {
    expect(hasVariant(CHAIN, "big", "no-background")).toBe(true);
    expect(hasVariant(CHAIN, "cutout", "upscaled-4x")).toBe(false);
    expect(hasVariant(CHAIN, "upload", "no-background")).toBe(false);
  });
});

describe("findVariant", () => {
  it("matches the source and the variant", () => {
    const assets = [
      ...CHAIN,
      asset("erased", "upload", "erased"),
      asset("double", "upload", "upscaled-2x"),
    ];
    expect(findVariant(assets, "upload", "no-background")?.id).toBe("cutout");
    expect(findVariant(assets, "upload", "upscaled-2x")?.id).toBe("double");
    expect(findVariant(assets, "upload", "upscaled-4x")).toBeUndefined();
  });
});

describe("isReusableVariant", () => {
  it("never reuses an erase by its source", () => {
    expect(isReusableVariant("erased")).toBe(false);
    expect(isReusableVariant("no-background")).toBe(true);
    expect(isReusableVariant("upscaled-2x")).toBe(true);
  });
});
