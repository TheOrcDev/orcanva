import { RiArrowRightLine, RiGithubFill } from "@remixicon/react";
import Link from "next/link";

import { Container } from "@/components/landing/container";
import { HeroLandscape } from "@/components/landing/hero-landscape";
import { ProductFrame } from "@/components/landing/product-frame";
import { badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import { STUDIO_PATH } from "@/lib/routes";
import { GITHUB_URL } from "@/lib/site";

// The bottom padding gives the product shot's shadow room to fade out before
// overflow-hidden clips it; the matching negative margin keeps the next
// section where it was.
export const Hero = () => (
  <section className="relative isolate -mb-16 overflow-hidden pb-16">
    {/* The painting keeps its own height, never shorter than 1040px and
        pinned to the top, so the sun stays put however tall the screen or
        this section is. The copy reaches down past the sun and the product
        shot starts just below it, on the first screen. */}
    <div className="h-hero absolute inset-x-0 top-0 -z-10">
      <HeroLandscape className="object-cover object-top" />
      <div
        aria-hidden
        className="to-background absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-b from-transparent"
      />
    </div>
    <Container className="min-h-below-sun flex flex-col items-center gap-6 pt-32 text-center md:pt-36">
      <a href="#features" className={badgeVariants()}>
        New · Filters and blur for every image
      </a>
      <h1 className="font-heading text-heading-lg md:text-display lg:text-display-lg max-w-6xl font-normal text-balance">
        From idea to design in minutes.
      </h1>
      {/* Full ink: the painting behind it is too busy for muted text */}
      <p className="max-w-xl text-lg text-pretty">
        The free, open-source Canva alternative for thumbnails and social
        images: every size from Story to 4K, background removal in your browser,{" "}
        {FONT_CATALOG.length} fonts, filters, and your team on the same canvas,
        live.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href={STUDIO_PATH} className={buttonVariants({ size: "xl" })}>
          Open Studio
          <RiArrowRightLine data-icon="inline-end" />
        </Link>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "xl", variant: "secondary" })}
        >
          <RiGithubFill data-icon="inline-start" />
          Star on GitHub
        </a>
      </div>
    </Container>
    <ProductFrame className="mt-8" />
  </section>
);
