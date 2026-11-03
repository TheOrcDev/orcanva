import { describe, expect, it } from "vitest";

import {
  assetFileUrl,
  templateAssetRow,
  templateEditorAsset,
} from "@/lib/templates/assets";
import { templateAssetId } from "@/lib/templates/export";
import type { TemplateAsset } from "@/lib/templates/schema";

const SHA = "5f351ff9d93f8791aa0b9c1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5e6f7";

const asset: TemplateAsset = {
  bytes: 1234,
  file: "5f351ff9d93f8791.webp",
  height: 941,
  id: templateAssetId(SHA),
  license: "MIT",
  mimeType: "image/webp",
  name: "Orc painter",
  source: "Orcanva's own watercolor",
  width: 1672,
};

describe("template assets", () => {
  it("serve uploads through storage and template images from public", () => {
    expect(assetFileUrl({ key: "assets/a.png", origin: "upload" })).toBe(
      "/api/storage/assets/a.png"
    );
    expect(
      assetFileUrl({
        key: "template-files/images/5f351ff9d93f8791.webp",
        origin: "template",
      })
    ).toBe("/template-files/images/5f351ff9d93f8791.webp");
  });

  it("become ready rows in nobody's library", () => {
    expect(templateAssetRow(asset)).toEqual({
      height: 941,
      id: asset.id,
      key: "template-files/images/5f351ff9d93f8791.webp",
      mimeType: "image/webp",
      origin: "template",
      originalName: "Orc painter",
      ownerId: null,
      sha256: null,
      sizeBytes: 1234,
      status: "ready",
      width: 1672,
    });
  });

  it("draw from their public file", () => {
    expect(templateEditorAsset(asset)).toEqual({
      height: 941,
      id: asset.id,
      name: "Orc painter",
      sourceAssetId: null,
      url: "/template-files/images/5f351ff9d93f8791.webp",
      variant: null,
      width: 1672,
    });
  });

  it("have the same version 5 id for the same file", () => {
    expect(templateAssetId(SHA)).toBe(templateAssetId(SHA));
    expect(templateAssetId(SHA)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    );
    expect(templateAssetId(SHA)).not.toBe(templateAssetId(`${SHA}0`));
  });
});
