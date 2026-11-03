import { describe, expect, it } from "vitest";

import { versionsToPrune } from "@/lib/versions/retention";
import type { StoredVersion } from "@/lib/versions/retention";
import type { VersionKind } from "@/lib/versions/schema";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// A whole day, so hour and day buckets line up with the offsets below
const NOW = Date.UTC(2026, 10, 3);

const version = (
  id: string,
  age: number,
  kind: VersionKind = "auto",
  sizeBytes = 1000
): StoredVersion => ({ createdAt: NOW - age, id, kind, sizeBytes });

const prune = (versions: StoredVersion[], budget?: number) =>
  versionsToPrune(versions, NOW, budget).toSorted();

describe("versionsToPrune", () => {
  it("keeps every auto version from the last day", () => {
    const versions = [0, 1, 2, 3].map((index) =>
      version(`a${index}`, (index + 1) * 5 * MINUTE)
    );
    versions.push(version("a4", 23 * HOUR));
    expect(prune(versions)).toEqual([]);
  });

  it("keeps the newest auto version of each hour for a week", () => {
    const versions = [
      version("newest", MINUTE),
      // Two in the same hour, two days ago
      version("hour-new", 2 * DAY + 10 * MINUTE),
      version("hour-old", 2 * DAY + 40 * MINUTE),
      // The next hour back
      version("next-hour", 2 * DAY + 70 * MINUTE),
    ];
    expect(prune(versions)).toEqual(["hour-old"]);
  });

  it("keeps the newest auto version of each day for a month", () => {
    const versions = [
      version("newest", MINUTE),
      version("day-new", 10 * DAY + 2 * HOUR),
      version("day-old", 10 * DAY + 5 * HOUR),
      version("day-before", 11 * DAY + HOUR),
    ];
    expect(prune(versions)).toEqual(["day-old"]);
  });

  it("drops auto versions older than a month", () => {
    const versions = [version("newest", MINUTE), version("old", 31 * DAY)];
    expect(prune(versions)).toEqual(["old"]);
  });

  it("keeps restore versions for a month", () => {
    const versions = [
      version("newest", MINUTE),
      version("recent", 29 * DAY, "restore"),
      version("old", 31 * DAY, "restore"),
    ];
    expect(prune(versions)).toEqual(["old"]);
  });

  it("never prunes named versions, however old", () => {
    const versions = [
      version("newest", MINUTE),
      version("named-old", 400 * DAY, "named"),
      version("named-same-hour-1", 2 * DAY + 10 * MINUTE, "named"),
      version("named-same-hour-2", 2 * DAY + 20 * MINUTE, "named"),
    ];
    expect(prune(versions)).toEqual([]);
  });

  it("always keeps the newest version, whatever its age or size", () => {
    expect(prune([version("only", 90 * DAY)])).toEqual([]);
    expect(prune([version("only", 90 * DAY, "restore")])).toEqual([]);
    expect(prune([version("huge", MINUTE, "auto", 10_000)], 100)).toEqual([]);
  });

  it("drops the oldest auto versions first to fit the byte budget", () => {
    const versions = [
      version("v1", MINUTE),
      version("v2", 2 * MINUTE),
      version("v3", 3 * MINUTE),
      version("restore", 4 * MINUTE, "restore"),
      version("v4", 5 * MINUTE),
    ];
    // 5000 bytes in all; 3000 fit
    expect(prune(versions, 3000)).toEqual(["v3", "v4"]);
  });

  it("drops restore versions once no auto version is left to drop", () => {
    const versions = [
      version("v1", MINUTE),
      version("restore-new", 2 * MINUTE, "restore"),
      version("named", 3 * MINUTE, "named"),
      version("restore-old", 4 * MINUTE, "restore"),
    ];
    expect(prune(versions, 2000)).toEqual(["restore-new", "restore-old"]);
  });

  it("leaves named versions over the budget alone", () => {
    const versions = [
      version("newest", MINUTE, "auto", 100),
      version("named", 2 * MINUTE, "named", 10_000),
    ];
    expect(prune(versions, 1000)).toEqual([]);
  });

  it("counts only the versions the tiers keep against the budget", () => {
    const versions = [
      version("newest", MINUTE, "auto", 500),
      version("expired", 40 * DAY, "auto", 10_000),
      version("kept", 2 * HOUR, "auto", 500),
    ];
    expect(prune(versions, 1000)).toEqual(["expired"]);
  });
});
