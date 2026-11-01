import heroLandscapeDark from "@/components/landing/assets/hero-landscape-dark.webp";
import heroLandscape from "@/components/landing/assets/hero-landscape.webp";
import { ThemedImage } from "@/components/landing/themed-image";

// The hero's watercolor: the one moment of colour on the page, a mountain
// lake at sunset by day and just after it at night
export const HeroLandscape = ({ className }: { className?: string }) => (
  <ThemedImage
    light={heroLandscape}
    dark={heroLandscapeDark}
    alt=""
    fill
    sizes="100vw"
    className={className}
  />
);
