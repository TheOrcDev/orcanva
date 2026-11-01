// The sponsors page, after videorc.com/sponsors: rank-ordered tiers, each a
// grid of sponsor logos topped up with empty "Be here" slots that ask to
// sponsor. There's no checkout yet, so a slot opens an email for its tier,
// and a sponsor goes live by being added to SPONSORS below.

export const SPONSORS_PATH = "/sponsors";

export const SPONSOR_EMAIL = "orc@videorc.com";

export const SPONSOR_TIER_IDS = [
  "diamond",
  "platinum",
  "gold",
  "silver",
] as const;

export type SponsorTierId = (typeof SPONSOR_TIER_IDS)[number];

export interface SponsorTier {
  id: SponsorTierId;
  label: string;
  // Desktop columns; the grid is two rows of them while it has room
  columns: number;
}

export const SPONSOR_TIERS: readonly SponsorTier[] = [
  { columns: 2, id: "diamond", label: "Diamond" },
  { columns: 3, id: "platinum", label: "Platinum" },
  { columns: 4, id: "gold", label: "Gold" },
  { columns: 6, id: "silver", label: "Silver" },
];

export interface Sponsor {
  name: string;
  tier: SponsorTierId;
  url: string;
  // A file in public/sponsors/, transparent background preferred
  logo?: string;
}

// The page groups these by tier and keeps this order within each
export const SPONSORS: readonly Sponsor[] = [];

const TIER_ROWS = 2;

// How many "Be here" slots follow a tier's sponsors: enough to fill its two
// rows, and once those are full, enough to finish the last row, leaving a
// whole free row when it ends flush
export const beHereSlotCount = (
  columns: number,
  sponsorCount: number
): number => {
  const capacity = columns * TIER_ROWS;
  if (sponsorCount < capacity) {
    return capacity - sponsorCount;
  }
  return columns - (sponsorCount % columns);
};

export const sponsorMailto = (tier: SponsorTier): string => {
  const subject = `${tier.label} sponsorship for Orcanva`;
  return `mailto:${SPONSOR_EMAIL}?subject=${encodeURIComponent(subject)}`;
};
