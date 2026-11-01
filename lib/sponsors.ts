// The sponsors page, after videorc.com/sponsors: rank-ordered tiers, each a
// grid of sponsor logos topped up with empty "Be here" slots that open the
// tier's checkout. Each tier is a monthly subscription sold through a Stripe
// Payment Link on the OrcDev account (products tagged project=orcanva), which
// asks for the name and site to show. A sponsor goes live by being added to
// SPONSORS below.

export const SPONSORS_PATH = "/sponsors";

export const SPONSOR_EMAIL = "orc@orcdev.com";

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
  monthlyUsd: number;
  checkoutUrl: string;
  // Desktop columns; the grid is two rows of them while it has room
  columns: number;
}

export const SPONSOR_TIERS: readonly SponsorTier[] = [
  {
    checkoutUrl: "https://buy.stripe.com/5kQ7sLbZ885cgzb8vf7g401",
    columns: 2,
    id: "diamond",
    label: "Diamond",
    monthlyUsd: 1000,
  },
  {
    checkoutUrl: "https://buy.stripe.com/4gM00j7IS3OWfv74eZ7g402",
    columns: 3,
    id: "platinum",
    label: "Platinum",
    monthlyUsd: 500,
  },
  {
    checkoutUrl: "https://buy.stripe.com/bJecN5bZ82KS82F9zj7g403",
    columns: 4,
    id: "gold",
    label: "Gold",
    monthlyUsd: 250,
  },
  {
    checkoutUrl: "https://buy.stripe.com/3cI28raV42KS4Qt8vf7g404",
    columns: 6,
    id: "silver",
    label: "Silver",
    monthlyUsd: 100,
  },
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

const usd = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency",
});

// "$1,000/mo"
export const formatMonthlyPrice = (tier: SponsorTier): string =>
  `${usd.format(tier.monthlyUsd)}/mo`;
