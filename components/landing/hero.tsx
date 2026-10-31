import { RiArrowRightLine } from "@remixicon/react";

import { Container } from "@/components/landing/container";
import { HeroLandscape } from "@/components/landing/hero-landscape";
import { PillLink } from "@/components/landing/pill-link";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import { STUDIO_PATH } from "@/lib/routes";

export const Hero = () => (
  <section className="relative isolate flex min-h-svh flex-col overflow-hidden">
    <HeroLandscape className="-z-10 object-cover" />
    <div
      aria-hidden
      className="to-linen absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-linear-to-b from-transparent"
    />
    <Container className="flex flex-col items-center gap-6 pt-32 pb-48 text-center md:pt-36">
      <a
        href="#features"
        className="bg-espresso hover:bg-espresso/85 outline-espresso rounded-full px-3 py-1.5 text-xs text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        New · Filters and blur for every image
      </a>
      <h1 className="text-heading-lg md:text-display lg:text-display-lg max-w-4xl font-normal text-balance">
        Thumbnails worth the click.
      </h1>
      <p className="text-graphite max-w-xl text-lg text-pretty">
        A calm editor for YouTube thumbnails and social images. Cut out
        backgrounds in your browser, set type in {FONT_CATALOG.length} fonts,
        and design together, live.
      </p>
      <PillLink href={STUDIO_PATH} size="lg" className="mt-2">
        Open Studio
        <RiArrowRightLine aria-hidden />
      </PillLink>
    </Container>
  </section>
);
