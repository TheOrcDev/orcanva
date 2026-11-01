import { cn } from "@/lib/utils";

// The Orcanva mark: a sun setting into a lake, framed like a canvas, and the
// sun is an orc: pointed ears, glaring eyes and two tusks rising out of the
// horizon. The sun and ears are the theme's primary and the eyes its ink on
// primary; the frame, water and tusks are the --logo-* tokens, and the frame
// and water turn to dusk in dark mode. The favicon (app/icon.svg) is a copy
// snapped to whole pixels, and the share image draws it with literal colours,
// so change all three together.
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
    <path
      d="M6.47 9.6C5.11 9.28 3.91 8.8 2.95 8c.32 1.68 1.28 3.12 2.48 4zM17.53 9.6c1.36-.32 2.56-.8 3.52-1.6-.32 1.68-1.28 3.12-2.48 4z"
      className="fill-primary"
    />
    <path d="M5 13.5a7 7 0 0 1 14 0z" className="fill-primary" />
    <path
      d="M8.1 9.1l2.8.8c-.1.8-.7 1.2-1.5 1.2-.9 0-1.4-.8-1.3-2zM15.9 9.1l-2.8.8c.1.8.7 1.2 1.5 1.2.9 0 1.4-.8 1.3-2z"
      className="fill-primary-foreground"
    />
    <path
      d="M8 13.5c-.2-.8-.3-1.4-.2-2.3 1.1.6 1.9 1.4 2.2 2.3zM16 13.5c.2-.8.3-1.4.2-2.3-1.1.6-1.9 1.4-2.2 2.3z"
      className="fill-logo-tusk"
    />
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
