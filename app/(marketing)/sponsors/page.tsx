import type { Metadata } from "next";
import Image from "next/image";

import { Container } from "@/components/landing/container";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { LogoMark } from "@/components/logo-mark";
import {
  beHereSlotCount,
  formatMonthlyPrice,
  SPONSOR_EMAIL,
  SPONSOR_TIERS,
  SPONSORS,
  SPONSORS_PATH,
} from "@/lib/sponsors";
import type { Sponsor, SponsorTier, SponsorTierId } from "@/lib/sponsors";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  alternates: { canonical: SPONSORS_PATH },
  description:
    "Sponsor Orcanva, the design studio that takes you from idea to design in minutes. Every tier puts your logo on orcanva.app.",
  title: "Sponsors",
};

// Spelled out so Tailwind sees every class
const TIER_GRID: Record<SponsorTierId, string> = {
  diamond: "grid-cols-1 sm:grid-cols-2",
  gold: "grid-cols-2 sm:grid-cols-4",
  platinum: "grid-cols-2 sm:grid-cols-3",
  silver: "grid-cols-3 sm:grid-cols-6",
};

const TIER_SLOT_HEIGHT: Record<SponsorTierId, string> = {
  diamond: "min-h-32",
  gold: "min-h-20",
  platinum: "min-h-24",
  silver: "min-h-12",
};

const SponsorCard = ({ sponsor }: { sponsor: Sponsor }) => (
  <a
    href={sponsor.url}
    target="_blank"
    rel="noopener noreferrer sponsored"
    className={cn(
      "bg-card hover:border-foreground/30 focus-visible:outline-ring flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
      TIER_SLOT_HEIGHT[sponsor.tier]
    )}
  >
    {sponsor.logo ? (
      <>
        <span className="relative h-12 w-4/5">
          <Image
            src={sponsor.logo}
            alt={sponsor.name}
            fill
            sizes="240px"
            className="object-contain"
          />
        </span>
        {sponsor.tier === "diamond" && (
          <span className="text-muted-foreground text-sm">{sponsor.name}</span>
        )}
      </>
    ) : (
      <span className="text-sm font-medium">{sponsor.name}</span>
    )}
  </a>
);

const TierSection = ({ tier }: { tier: SponsorTier }) => {
  const sponsors = SPONSORS.filter((sponsor) => sponsor.tier === tier.id);
  const emptySlots = beHereSlotCount(tier.columns, sponsors.length);

  return (
    <section aria-labelledby={`${tier.id}-heading`}>
      <div className="text-muted-foreground flex items-baseline justify-between gap-4 border-b pb-3 text-xs">
        <h2
          id={`${tier.id}-heading`}
          className="font-semibold tracking-widest uppercase"
        >
          {tier.label}
        </h2>
        <p className="tabular-nums">{formatMonthlyPrice(tier)}</p>
      </div>
      <div className={cn("grid gap-3 pt-4", TIER_GRID[tier.id])}>
        {sponsors.map((sponsor) => (
          <SponsorCard key={sponsor.url} sponsor={sponsor} />
        ))}
        {Array.from({ length: emptySlots }, (_, index) => (
          <a
            key={index}
            href={tier.checkoutUrl}
            aria-label={`Become a ${tier.label} sponsor for ${formatMonthlyPrice(tier)}`}
            className={cn(
              "text-muted-foreground hover:border-foreground/40 hover:text-foreground focus-visible:outline-ring flex items-center justify-center rounded-2xl border border-dashed px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
              TIER_SLOT_HEIGHT[tier.id]
            )}
          >
            Be here
          </a>
        ))}
      </div>
    </section>
  );
};

const SponsorsPage = () => (
  <>
    <SiteNav />
    <main className="pt-32 pb-20 md:pt-36 md:pb-30">
      <Container className="max-w-4xl">
        <header className="flex flex-col items-center gap-6 pb-14 text-center">
          <LogoMark className="size-16" />
          <h1 className="font-heading text-heading-lg md:text-display font-normal text-balance">
            Sponsor Orcanva
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty">
            Keep the studio shipping. Every tier puts your logo and name on this
            page, linked to your site, and in the newsletter for Orcanva
            updates.
          </p>
        </header>
        <div className="flex flex-col gap-12">
          {SPONSOR_TIERS.map((tier) => (
            <TierSection key={tier.id} tier={tier} />
          ))}
        </div>
        <p className="text-muted-foreground pt-14 text-center text-sm">
          Questions, invoices, or a custom arrangement?{" "}
          <a
            href={`mailto:${SPONSOR_EMAIL}`}
            className="hover:text-foreground underline underline-offset-4"
          >
            {SPONSOR_EMAIL}
          </a>
        </p>
      </Container>
    </main>
    <SiteFooter />
  </>
);

export default SponsorsPage;
