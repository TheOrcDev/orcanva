import { RiArrowRightLine } from "@remixicon/react";
import Link from "next/link";

import { Container } from "@/components/landing/container";
import { HeroLandscape } from "@/components/landing/hero-landscape";
import { badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import { STUDIO_PATH } from "@/lib/routes";

export const Hero = () => (
  <section className="relative isolate flex min-h-svh flex-col overflow-hidden">
    {/* Pinned to the top and never shorter than 1040px, so short screens
        crop the lake instead of pulling the horizon up behind the copy */}
    <HeroLandscape className="-z-10 min-h-260 object-cover object-top" />
    <div
      aria-hidden
      className="to-background absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-linear-to-b from-transparent"
    />
    <Container className="flex flex-col items-center gap-6 pt-32 pb-48 text-center md:pt-36">
      <a href="#features" className={badgeVariants()}>
        New · Filters and blur for every image
      </a>
      <h1 className="font-heading text-heading-lg md:text-display lg:text-display-lg max-w-4xl font-normal text-balance">
        Thumbnails worth the click.
      </h1>
      {/* Full ink: the painting behind it is too busy for muted text */}
      <p className="max-w-xl text-lg text-pretty">
        A calm editor for YouTube thumbnails and social images. Cut out
        backgrounds in your browser, set type in {FONT_CATALOG.length} fonts,
        and design together, live.
      </p>
      <Link
        href={STUDIO_PATH}
        className={buttonVariants({ className: "mt-2", size: "xl" })}
      >
        Open Studio
        <RiArrowRightLine data-icon="inline-end" />
      </Link>
    </Container>
  </section>
);
