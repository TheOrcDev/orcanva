import Image, { getImageProps } from "next/image";
import type { StaticImageData } from "next/image";

import { WarmHiddenTheme } from "@/components/landing/warm-hidden-theme";
import { cn } from "@/lib/utils";

interface ThemedImageProps {
  alt: string;
  className?: string;
  dark: StaticImageData;
  fill?: boolean;
  light: StaticImageData;
  sizes: string;
}

const candidates = (
  src: StaticImageData,
  { alt, fill, sizes }: ThemedImageProps
) => {
  const { props } = getImageProps({ alt, fill, sizes, src });
  return { sizes, srcSet: props.srcSet ?? "" };
};

// A picture with a day and a night version. The theme class decides which
// shows, so there's no flash on load. Neither is preloaded: lazy loading
// skips the hidden one and the blur stands in until the visible one
// arrives. The hidden one is fetched once the page is idle, so switching
// themes doesn't wait for it.
export const ThemedImage = (props: ThemedImageProps) => {
  const { alt, className, dark, fill, light, sizes } = props;
  return (
    <>
      <Image
        src={light}
        alt={alt}
        fill={fill}
        placeholder="blur"
        sizes={sizes}
        className={cn("dark:hidden", className)}
      />
      <Image
        src={dark}
        alt={alt}
        fill={fill}
        placeholder="blur"
        sizes={sizes}
        className={cn("hidden dark:block", className)}
      />
      <WarmHiddenTheme
        light={candidates(light, props)}
        dark={candidates(dark, props)}
      />
    </>
  );
};
