import { describe, expect, it } from "vitest";

import { safeNext, signInUrl } from "@/lib/auth/redirect";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/design/abc?x=1#y")).toBe("/design/abc?x=1#y");
    expect(safeNext("/")).toBe("/");
  });

  it("falls back for anything that could leave the site", () => {
    for (const next of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "mailto:someone@example.com",
      "design",
      "",
      null,
      undefined,
    ]) {
      expect(safeNext(next)).toBe("/");
    }
  });

  it("uses the given fallback", () => {
    expect(safeNext("https://evil.example", "/design/abc")).toBe("/design/abc");
  });
});

describe("signInUrl", () => {
  it("comes back to the page it was opened from", () => {
    expect(signInUrl("/")).toBe("/auth/sign-in");
    expect(signInUrl("/design/abc")).toBe("/auth/sign-in?next=%2Fdesign%2Fabc");
  });
});
