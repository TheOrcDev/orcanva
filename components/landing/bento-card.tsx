import { RiArrowRightLine } from "@remixicon/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// With an href the title is a link that covers the whole tile
const Title = ({ href, title }: { href?: string; title: string }) => {
  if (!href) {
    return title;
  }
  return (
    <Link
      href={href}
      className="focus-visible:after:outline-ring after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2"
    >
      {title}
      <RiArrowRightLine
        aria-hidden
        className="ml-1 inline size-4 align-[-0.125em] transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
};

// One tile of the bento grid (magic-bento.tsx): a picture area that takes
// whatever height is left, then the copy. The spotlight and the 1px edge
// light sit on top, drawn by app/globals.css from the positions the grid
// writes.
export const BentoCard = ({
  children,
  className,
  description,
  href,
  title,
  visual,
  visualClassName,
}: {
  children?: ReactNode;
  className?: string;
  description: ReactNode;
  href?: string;
  title: string;
  visual: ReactNode;
  visualClassName?: string;
}) => (
  <li
    data-bento-card
    className={cn(
      "bento-card group bg-card ring-foreground/5 relative isolate flex flex-col overflow-hidden rounded-3xl ring-1",
      className
    )}
  >
    <div
      className={cn(
        "relative min-h-56 flex-1 overflow-hidden md:min-h-0",
        visualClassName
      )}
    >
      {visual}
    </div>
    <div className="flex flex-col gap-1.5 p-6 pt-5">
      <h3 className="font-heading text-lg font-medium">
        <Title href={href} title={title} />
      </h3>
      <p className="text-muted-foreground text-sm text-pretty">{description}</p>
    </div>
    {children}
    <span
      aria-hidden
      className="bento-light pointer-events-none absolute inset-0"
    />
    <span
      aria-hidden
      className="bento-edge pointer-events-none absolute inset-0"
    />
  </li>
);
