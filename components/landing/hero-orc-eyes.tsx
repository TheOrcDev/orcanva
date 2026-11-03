import { cn } from "@/lib/utils";

interface Orc {
  className: string;
  // The disc that answers the pointer, ears included
  disc: { cx: number; cy: number; r: number };
  // The painted eyes, outer corner first like the logo's
  eyes: readonly [string, string];
  glow: number;
  id: string;
  viewBox: string;
}

// Measured on the hero's webps (components/landing/assets), in their pixels,
// so repainting either one means measuring again
const SUN: Orc = {
  className: "dark:hidden",
  disc: { cx: 808, cy: 560, r: 34 },
  eyes: [
    "M789.8 548.6l13.6 3.3c-.2 2.7-2.4 5-5.8 5-4.2 0-8-2.7-7.8-8.3z",
    "M826.8 548.6l-13.6 3.3c.2 2.7 2.4 5 5.8 5 4.2 0 8-2.7 7.8-8.3z",
  ],
  glow: 2.5,
  id: "hero-sun-eyes",
  viewBox: "0 0 1586 992",
};

const MOON: Orc = {
  className: "hidden dark:block",
  disc: { cx: 1373, cy: 172.5, r: 26 },
  eyes: [
    "M1362.8 166.8l7.6 1.8c-.1 1.7-1.4 3.2-3.4 3.2-2.4 0-4.4-1.8-4.2-5z",
    "M1385.4 166.8l-7.6 1.8c.1 1.7 1.4 3.2 3.4 3.2 2.4 0 4.4-1.8 4.2-5z",
  ],
  glow: 1.8,
  id: "hero-moon-eyes",
  viewBox: "0 0 1776 1104",
};

const OrcEyes = ({ orc }: { orc: Orc }) => {
  const { cx, cy, r } = orc.disc;
  return (
    <svg
      aria-hidden
      viewBox={orc.viewBox}
      preserveAspectRatio="xMidYMin slice"
      className={cn(
        "pointer-events-none absolute inset-0 size-full",
        orc.className
      )}
    >
      <filter
        id={orc.id}
        filterUnits="userSpaceOnUse"
        x={cx - r}
        y={cy - r}
        width={r * 2}
        height={r * 2}
      >
        <feGaussianBlur stdDeviation={orc.glow} result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <g className="group">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="transparent"
          className="pointer-events-auto"
        />
        <g
          filter={`url(#${orc.id})`}
          className="fill-orc-eye opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
        >
          {orc.eyes.map((d) => (
            <path
              key={d}
              d={d}
              className="origin-center transition-transform duration-300 transform-fill group-hover:scale-130 motion-reduce:transition-none"
            />
          ))}
        </g>
      </g>
    </svg>
  );
};

// The orc in the hero painting: the sun by day and the moon at night carry
// the logo's glaring eyes, faint in the paint. Hovering either one turns
// them red, a little bigger and glowing. Each layer uses its painting's own
// pixels, and xMidYMin slice places it the way object-cover object-top
// places the painting, so the eyes stay on the painted ones at any width.
export const HeroOrcEyes = () => (
  <>
    <OrcEyes orc={SUN} />
    <OrcEyes orc={MOON} />
  </>
);
