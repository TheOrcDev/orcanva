import { cn } from "@/lib/utils";

// The Orcanva mark: a sun setting into a lake, framed like a canvas. The sun
// is the theme's primary; the frame and water are the --logo-* tokens, which
// turn to dusk in dark mode. The favicon (app/icon.svg) is a copy snapped to
// whole pixels, and the share image draws it with literal colours, so change
// all three together.
export const LogoMark = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    fill="none"
    className={cn("shrink-0", className)}
  >
    <rect
      x="0.5"
      y="0.5"
      width="23"
      height="23"
      rx="3.5"
      strokeWidth="1"
      className="stroke-logo-frame"
    />
    <path d="M5 13.5a7 7 0 0 1 14 0z" className="fill-primary" />
    <rect
      x="1.9"
      y="13.5"
      width="20.2"
      height="0.8"
      rx="0.4"
      className="fill-logo-frame"
    />
    <rect
      x="6.1"
      y="15.2"
      width="11.8"
      height="1.6"
      rx="0.8"
      className="fill-logo-water"
    />
    <rect
      x="9.25"
      y="17.4"
      width="5.5"
      height="1.6"
      rx="0.8"
      className="fill-logo-water"
    />
  </svg>
);
