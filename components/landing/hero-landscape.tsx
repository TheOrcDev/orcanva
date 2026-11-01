import Image from "next/image";

import heroLandscapeDark from "@/components/landing/assets/hero-landscape-dark.webp";
import heroLandscape from "@/components/landing/assets/hero-landscape.webp";
import { cn } from "@/lib/utils";

// The hero's watercolor: the one moment of colour on the page, a mountain
// lake at sunset by day and just after it at night. The theme class decides
// which shows, so there's no flash on load. Neither is preloaded: lazy
// loading skips whichever painting is hidden, and the blur stands in until
// the visible one arrives.
export const HeroLandscape = ({ className }: { className?: string }) => (
  <>
    <Image
      src={heroLandscape}
      alt=""
      fill
      placeholder="blur"
      sizes="100vw"
      className={cn("dark:hidden", className)}
    />
    <Image
      src={heroLandscapeDark}
      alt=""
      fill
      placeholder="blur"
      sizes="100vw"
      className={cn("hidden dark:block", className)}
    />
  </>
);
