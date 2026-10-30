import { describe, expect, it } from "vitest";

import { formatRelativeTime, formatSize } from "@/lib/format";

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-30T12:00:00Z");

  it("says just now for recent edits", () => {
    expect(formatRelativeTime(new Date("2026-10-30T11:59:30Z"), now)).toBe(
      "just now"
    );
  });

  it("picks the largest whole unit", () => {
    expect(formatRelativeTime(new Date("2026-10-30T11:55:00Z"), now)).toBe(
      "5 minutes ago"
    );
    expect(formatRelativeTime(new Date("2026-10-29T12:00:00Z"), now)).toBe(
      "yesterday"
    );
    expect(formatRelativeTime(new Date("2026-10-16T12:00:00Z"), now)).toBe(
      "2 weeks ago"
    );
  });
});

describe("formatSize", () => {
  it("renders width × height", () => {
    expect(formatSize(1280, 720)).toBe("1280 × 720");
  });
});
