import Image from "next/image";

import heroLandscape from "@/components/landing/assets/hero-landscape.svg";

// The hero's painted sunset: the one moment of colour on the page. A coded
// placeholder for now; to use the real watercolor, swap the import for the
// painting (e.g. hero-landscape.avif) and add placeholder="blur"
export const HeroLandscape = ({ className }: { className?: string }) => (
  <Image
    src={heroLandscape}
    alt=""
    fill
    preload
    sizes="100vw"
    className={className}
  />
);
