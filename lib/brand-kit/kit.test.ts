import { describe, expect, it } from "vitest";

import {
  brandCountLabel,
  brandFonts,
  logoChoices,
  withBrandItem,
  withoutBrandItem,
} from "@/lib/brand-kit/kit";
import { BRAND_KIT_LIMITS, EMPTY_BRAND_KIT } from "@/lib/brand-kit/schema";
import type { EditorAsset } from "@/lib/editor/store";
import { getFont } from "@/lib/fonts/catalog";

const asset = (id: string): EditorAsset => ({
  height: 100,
  id,
  name: `${id}.png`,
  sourceAssetId: null,
  url: `/api/storage/assets/${id}.png`,
  width: 100,
});

describe("brand kit changes", () => {
  it("adds at the end, once, in the stored spelling", () => {
    const one = withBrandItem(EMPTY_BRAND_KIT, {
      kind: "color",
      value: "#FF0000",
    });
    expect(one.colors).toEqual(["#ff0000"]);
    const two = withBrandItem(one, { kind: "color", value: "#00ff00" });
    expect(two.colors).toEqual(["#ff0000", "#00ff00"]);
    expect(withBrandItem(two, { kind: "color", value: "#f00" })).toBe(two);
    expect(
      withBrandItem(EMPTY_BRAND_KIT, { kind: "font", value: "anton" }).fonts
    ).toEqual(["anton"]);
  });

  it("adds a logo only with its upload, and nothing to a full kit", () => {
    const logo = asset("a");
    expect(
      withBrandItem(EMPTY_BRAND_KIT, { kind: "logo", value: "a" }, logo).logos
    ).toEqual([logo]);
    expect(withBrandItem(EMPTY_BRAND_KIT, { kind: "logo", value: "a" })).toBe(
      EMPTY_BRAND_KIT
    );
    const full = {
      ...EMPTY_BRAND_KIT,
      fonts: Array.from({ length: BRAND_KIT_LIMITS.font }, () => "inter"),
    };
    expect(withBrandItem(full, { kind: "font", value: "anton" })).toBe(full);
  });

  it("removes an item, and leaves a kit without it alone", () => {
    const kit = {
      colors: ["#ff0000", "#00ff00"],
      fonts: ["anton"],
      logos: [asset("a"), asset("b")],
    };
    expect(
      withoutBrandItem(kit, { kind: "color", value: "#FF0000" }).colors
    ).toEqual(["#00ff00"]);
    expect(
      withoutBrandItem(kit, { kind: "font", value: "anton" }).fonts
    ).toEqual([]);
    expect(
      withoutBrandItem(kit, { kind: "logo", value: "a" }).logos.map(
        (logo) => logo.id
      )
    ).toEqual(["b"]);
    expect(withoutBrandItem(kit, { kind: "font", value: "inter" })).toBe(kit);
  });
});

describe("brand kit display", () => {
  it("counts against the limits", () => {
    const kit = { ...EMPTY_BRAND_KIT, colors: ["#ff0000", "#00ff00"] };
    expect(brandCountLabel(kit, "color")).toBe("2 of 24");
    expect(brandCountLabel(kit, "logo")).toBe("0 of 12");
  });

  it("shows catalog fonts, skipping dropped ones", () => {
    const kit = { ...EMPTY_BRAND_KIT, fonts: ["anton", "gone-font", "inter"] };
    expect(brandFonts(kit)).toEqual([getFont("anton"), getFont("inter")]);
  });

  it("offers uploads that aren't logos yet, in library order", () => {
    const library = [asset("c"), asset("b"), asset("a")];
    const kit = { ...EMPTY_BRAND_KIT, logos: [asset("b")] };
    expect(logoChoices(library, kit).map((item) => item.id)).toEqual([
      "c",
      "a",
    ]);
  });
});
