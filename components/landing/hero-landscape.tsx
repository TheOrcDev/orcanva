import Image from "next/image";

import heroLandscapeDark from "@/components/landing/assets/hero-landscape-dark.svg";
import heroLandscape from "@/components/landing/assets/hero-landscape.svg";
import { cn } from "@/lib/utils";

// The hero's painted landscape: the one moment of colour on the page, at
// sunset by day and just after it at night. The theme class decides which
// shows, so there's no flash on load. Coded placeholders for now; to use
// real watercolors, swap the imports for the paintings (e.g. .avif), add
// placeholder="blur", and drop preload: the placeholders are tiny enough to
// fetch both, but lazy loading skips whichever painting is hidden.
export const HeroLandscape = ({ className }: { className?: string }) => (
  <>
    <Image
      src={heroLandscape}
      alt=""
      fill
      preload
      sizes="100vw"
      className={cn("dark:hidden", className)}
    />
    <Image
      src={heroLandscapeDark}
      alt=""
      fill
      preload
      sizes="100vw"
      className={cn("hidden dark:block", className)}
    />
  </>
);
