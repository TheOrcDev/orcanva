import { describe, expect, it } from "vitest";

import { beHereSlotCount, SPONSOR_TIERS, sponsorMailto } from "@/lib/sponsors";

describe("beHereSlotCount", () => {
  it("fills two empty rows when a tier has no sponsors", () => {
    expect(beHereSlotCount(4, 0)).toBe(8);
  });

  it("tops the two rows up around the sponsors", () => {
    expect(beHereSlotCount(4, 3)).toBe(5);
  });

  it("finishes the last row once the two rows are full", () => {
    expect(beHereSlotCount(4, 9)).toBe(3);
  });

  it("leaves a whole free row when the sponsors end flush", () => {
    expect(beHereSlotCount(4, 8)).toBe(4);
    expect(beHereSlotCount(4, 12)).toBe(4);
  });
});

describe("sponsorMailto", () => {
  it("names the tier in the subject", () => {
    const [diamond] = SPONSOR_TIERS;
    expect(sponsorMailto(diamond)).toBe(
      "mailto:orc@videorc.com?subject=Diamond%20sponsorship%20for%20Orcanva"
    );
  });
});
