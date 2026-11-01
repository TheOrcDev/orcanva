import { describe, expect, it } from "vitest";

import { safeNext, signInUrl, signUpUrl } from "@/lib/auth/redirect";
import { STUDIO_PATH } from "@/lib/routes";

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
      expect(safeNext(next)).toBe(STUDIO_PATH);
    }
  });

  it("uses the given fallback", () => {
    expect(safeNext("https://evil.example", "/design/abc")).toBe("/design/abc");
  });
});

describe("signInUrl", () => {
  it("comes back to the page it was opened from", () => {
    expect(signInUrl(STUDIO_PATH)).toBe("/auth/sign-in");
    expect(signInUrl("/")).toBe("/auth/sign-in?next=%2F");
    expect(signInUrl("/design/abc")).toBe("/auth/sign-in?next=%2Fdesign%2Fabc");
  });
});

describe("signUpUrl", () => {
  it("fills in the email it was given", () => {
    expect(signUpUrl(STUDIO_PATH)).toBe("/auth/sign-up");
    expect(signUpUrl(STUDIO_PATH, "jay@example.com")).toBe(
      "/auth/sign-up?email=jay%40example.com"
    );
    expect(signUpUrl("/invite/abc", "jay+1@example.com")).toBe(
      "/auth/sign-up?next=%2Finvite%2Fabc&email=jay%2B1%40example.com"
    );
  });
});
