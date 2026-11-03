import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { COMPARE_LINKS, TOOL_LINKS } from "@/lib/seo/landing-links";
import { SIZE_PAGES, sizePagePath } from "@/lib/seo/size-pages";

const LINKS = [...TOOL_LINKS, ...COMPARE_LINKS];
const MARKETING = path.join(import.meta.dirname, "../../app/(marketing)");
// The maker pages are one template over lib/seo/size-pages.ts
const SIZE_PATHS = new Set(SIZE_PAGES.map((page) => sizePagePath(page)));

describe("landing links", () => {
  it("are unique", () => {
    const hrefs = LINKS.map((link) => link.href);
    const labels = LINKS.map((link) => link.label);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("each lead to a page", () => {
    for (const link of LINKS) {
      const page = SIZE_PATHS.has(link.href)
        ? path.join(MARKETING, "[slug]", "page.tsx")
        : path.join(MARKETING, link.href, "page.tsx");
      expect(existsSync(page), `${link.href} has no page`).toBe(true);
    }
  });
});
