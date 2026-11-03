import { describe, expect, it } from "vitest";

import {
  formatVersionTime,
  possessive,
  versionByline,
  versionTitle,
} from "@/lib/versions/labels";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-11-03T15:30:00Z");
const UTC = { locale: "en-GB", timeZone: "UTC" };

describe("version labels", () => {
  it("names autosaves after the person whose edits came next", () => {
    const version = { createdByName: "Jay", kind: "auto", name: null } as const;
    expect(versionTitle(version)).toBe("Autosave");
    expect(versionByline(version)).toBe("Before Jay's edits");
  });

  it("shows a named version's own name and who saved it", () => {
    const version = {
      createdByName: "Mia",
      kind: "named",
      name: "Final v2",
    } as const;
    expect(versionTitle(version)).toBe("Final v2");
    expect(versionByline(version)).toBe("Saved by Mia");
  });

  it("says a restore version is the design before someone restored", () => {
    const version = {
      createdByName: "Jay",
      kind: "restore",
      name: null,
    } as const;
    expect(versionTitle(version)).toBe("Before restore");
    expect(versionByline(version)).toBe(
      "Before Jay restored an earlier version"
    );
  });

  it("writes possessives for names ending in s", () => {
    expect(possessive("James")).toBe("James'");
    expect(possessive("Guest")).toBe("Guest's");
  });
});

describe("formatVersionTime", () => {
  it("shows only the time for today", () => {
    expect(formatVersionTime(at("2026-11-03T14:02:00Z"), NOW, UTC)).toBe(
      "14:02"
    );
  });

  it("says yesterday", () => {
    expect(formatVersionTime(at("2026-11-02T23:59:00Z"), NOW, UTC)).toBe(
      "Yesterday, 23:59"
    );
  });

  it("leaves out this year, and shows other years", () => {
    expect(formatVersionTime(at("2026-10-20T09:05:00Z"), NOW, UTC)).toBe(
      "20 Oct, 09:05"
    );
    expect(formatVersionTime(at("2025-12-31T09:05:00Z"), NOW, UTC)).toBe(
      "31 Dec 2025, 09:05"
    );
  });

  it("counts days in the given time zone", () => {
    // 23:30 UTC on the 2nd is already the 3rd in Belgrade
    expect(
      formatVersionTime(at("2026-11-02T23:30:00Z"), NOW, {
        locale: "en-GB",
        timeZone: "Europe/Belgrade",
      })
    ).toBe("00:30");
  });
});
