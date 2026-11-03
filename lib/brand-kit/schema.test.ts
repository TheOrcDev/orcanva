import { describe, expect, it } from "vitest";

import {
  BRAND_KIT_LIMITS,
  EMPTY_BRAND_KIT,
  addRefusal,
  brandKitItem,
  isBrandKitFull,
  kitFromItems,
} from "@/lib/brand-kit/schema";
import type { StoredBrandKitItem } from "@/lib/brand-kit/schema";
import type { EditorAsset } from "@/lib/editor/store";

const LOGO_ID = "7b0c4f5e-8d9a-4c3b-9e2f-1a2b3c4d5e6f";

const asset = (id: string): EditorAsset => ({
  height: 100,
  id,
  name: "logo.png",
  sourceAssetId: null,
  url: `/api/storage/assets/${id}.png`,
  variant: null,
  width: 100,
});

const hex = (index: number) => `#0000${index.toString(16).padStart(2, "0")}`;

describe("brand kit input", () => {
  it("takes hex colours and stores them lowercase", () => {
    expect(brandKitItem.parse({ kind: "color", value: "#FF8800" })).toEqual({
      kind: "color",
      value: "#ff8800",
    });
    expect(brandKitItem.parse({ kind: "color", value: "#f80f" }).value).toBe(
      "#ff8800"
    );
    expect(
      brandKitItem.safeParse({ kind: "color", value: "orange" }).success
    ).toBe(false);
  });

  it("takes catalog fonts only", () => {
    expect(brandKitItem.parse({ kind: "font", value: "anton" }).value).toBe(
      "anton"
    );
    expect(
      brandKitItem.safeParse({ kind: "font", value: "comic-sans" }).success
    ).toBe(false);
  });

  it("takes logos by upload id", () => {
    expect(brandKitItem.parse({ kind: "logo", value: LOGO_ID }).value).toBe(
      LOGO_ID
    );
    expect(
      brandKitItem.safeParse({ kind: "logo", value: "logo.png" }).success
    ).toBe(false);
    expect(
      brandKitItem.safeParse({ kind: "pattern", value: "x" }).success
    ).toBe(false);
  });
});

describe("kitFromItems", () => {
  it("sorts rows into colours, fonts and logos, in order", () => {
    const items: StoredBrandKitItem[] = [
      { kind: "font", logo: null, value: "inter" },
      { kind: "color", logo: null, value: "#ff0000" },
      { kind: "logo", logo: asset(LOGO_ID), value: LOGO_ID },
      { kind: "color", logo: null, value: "#00ff00" },
      { kind: "font", logo: null, value: "anton" },
    ];
    expect(kitFromItems(items)).toEqual({
      colors: ["#ff0000", "#00ff00"],
      fonts: ["inter", "anton"],
      logos: [asset(LOGO_ID)],
    });
  });

  it("leaves out what no longer reads", () => {
    const items: StoredBrandKitItem[] = [
      { kind: "color", logo: null, value: "red" },
      { kind: "color", logo: null, value: "#FF0000" },
      { kind: "color", logo: null, value: "#ff0000" },
      { kind: "font", logo: null, value: "a-font-we-dropped" },
      // Its upload was deleted or isn't ready
      { kind: "logo", logo: null, value: LOGO_ID },
    ];
    expect(kitFromItems(items)).toEqual({
      colors: ["#ff0000"],
      fonts: [],
      logos: [],
    });
  });

  it("never holds more than the limits", () => {
    const items = Array.from(
      { length: 30 },
      (_, index): StoredBrandKitItem => ({
        kind: "color",
        logo: null,
        value: hex(index),
      })
    );
    const kit = kitFromItems(items);
    expect(kit.colors).toHaveLength(BRAND_KIT_LIMITS.color);
    expect(isBrandKitFull(kit, "color")).toBe(true);
    expect(isBrandKitFull(kit, "font")).toBe(false);
  });
});

describe("addRefusal", () => {
  it("says nothing when the item is in the kit", () => {
    const kit = { ...EMPTY_BRAND_KIT, colors: ["#ff0000"] };
    expect(addRefusal(kit, { kind: "color", value: "#ff0000" })).toBeNull();
  });

  it("says when the kit is full", () => {
    const fonts = Array.from({ length: BRAND_KIT_LIMITS.font }, () => "inter");
    expect(
      addRefusal(
        { ...EMPTY_BRAND_KIT, fonts },
        { kind: "font", value: "anton" }
      )
    ).toBe("Your brand kit holds up to 10 fonts");
  });

  it("says when a logo isn't one of your uploads", () => {
    expect(addRefusal(EMPTY_BRAND_KIT, { kind: "logo", value: LOGO_ID })).toBe(
      "That image isn't in your uploads"
    );
  });
});
