import { describe, expect, it } from "vitest";

import {
  createInviteToken,
  hashInviteToken,
  invitePath,
  isInviteToken,
  shareEmail,
} from "@/lib/sharing/invite";

describe("invite tokens", () => {
  it("makes a fresh, well-formed token each time, stored only as a hash", () => {
    const first = createInviteToken();
    const second = createInviteToken();
    expect(first.token).not.toBe(second.token);
    expect(isInviteToken(first.token)).toBe(true);
    expect(first.tokenHash).toBe(hashInviteToken(first.token));
    expect(first.tokenHash).not.toContain(first.token);
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("refuses anything that isn't a token", () => {
    for (const value of ["", "abc", `${"a".repeat(43)}/`, "a".repeat(44)]) {
      expect(isInviteToken(value)).toBe(false);
    }
  });

  it("links to the invite page", () => {
    const { token } = createInviteToken();
    expect(invitePath(token)).toBe(`/invite/${token}`);
  });
});

describe("shareEmail", () => {
  it("stores addresses trimmed and lowercased", () => {
    expect(shareEmail.parse("  Jay.Orc@Example.COM ")).toBe(
      "jay.orc@example.com"
    );
  });

  it("refuses what isn't an email address", () => {
    for (const value of [
      "",
      "jay",
      "jay@",
      "@example.com",
      "a b@example.com",
    ]) {
      expect(shareEmail.safeParse(value).success).toBe(false);
    }
  });
});
