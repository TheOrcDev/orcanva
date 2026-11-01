import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

// The share card every landing page uses: the hero's watercolor with the
// wordmark, the page's headline and a line under it in its sky. Each page's
// opengraph-image.tsx renders it once at build time. The image renderer takes
// no stylesheet and can't read WebP, so the painting is a 1200x630 JPEG crop
// of components/landing/assets/hero-landscape.webp, pinned to the top like
// the hero (redo it if the hero changes), and the colours and fonts are
// literal copies of the theme's (Figtree for headings, Instrument Sans for
// text).
export const SHARE_IMAGE_SIZE = { height: 630, width: 1200 };
export const SHARE_IMAGE_TYPE = "image/png";

const asset = (file: string) =>
  readFile(path.join(process.cwd(), "assets", file));
// The renderer needs static TTFs or OTFs, not next/font's variable WOFF2
const [figtreeMedium, figtreeSemiBold, instrumentSans, painting] =
  await Promise.all([
    asset("fonts/Figtree-Medium.ttf"),
    asset("fonts/Figtree-SemiBold.ttf"),
    asset("fonts/InstrumentSans-Regular.ttf"),
    asset("hero-landscape-og.jpg"),
  ]);

// --foreground by day, the same plum as the ink on primary (the orc's eyes)
const FOREGROUND = "#1f1322";

// Longer headlines step down a size so they still fit on two lines
const LONG_TITLE = 32;

export const renderShareImage = ({
  subtitle,
  title,
}: {
  subtitle: string;
  title: string;
}) =>
  new ImageResponse(
    <div
      style={{
        alignItems: "center",
        color: FOREGROUND,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Figtree",
        height: "100%",
        paddingTop: 52,
        position: "relative",
        width: "100%",
      }}
    >
      <img
        alt=""
        src={`data:image/jpeg;base64,${painting.toString("base64")}`}
        width={SHARE_IMAGE_SIZE.width}
        height={SHARE_IMAGE_SIZE.height}
        style={{ left: 0, position: "absolute", top: 0 }}
      />
      <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
        {/* components/logo-mark.tsx in its day colours */}
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <rect
            x="0.5"
            y="0.5"
            width="23"
            height="23"
            rx="3.5"
            stroke="#9c7096"
            strokeWidth="1"
          />
          <path
            d="M6.47 9.6C5.11 9.28 3.91 8.8 2.95 8c.32 1.68 1.28 3.12 2.48 4zM17.53 9.6c1.36-.32 2.56-.8 3.52-1.6-.32 1.68-1.28 3.12-2.48 4z"
            fill="#f19b89"
          />
          <path d="M5 13.5a7 7 0 0 1 14 0z" fill="#f19b89" />
          <path
            d="M8.1 9.1l2.8.8c-.1.8-.7 1.2-1.5 1.2-.9 0-1.4-.8-1.3-2zM15.9 9.1l-2.8.8c.1.8.7 1.2 1.5 1.2.9 0 1.4-.8 1.3-2z"
            fill={FOREGROUND}
          />
          <path
            d="M8 13.5c-.2-.8-.3-1.4-.2-2.3 1.1.6 1.9 1.4 2.2 2.3zM16 13.5c.2-.8.3-1.4.2-2.3-1.1.6-1.9 1.4-2.2 2.3z"
            fill="#fef4e5"
          />
          <rect
            x="1.9"
            y="13.5"
            width="20.2"
            height="0.8"
            rx="0.4"
            fill="#9c7096"
          />
          <rect
            x="6.1"
            y="15.2"
            width="11.8"
            height="1.6"
            rx="0.8"
            fill="#bfadcc"
          />
          <rect
            x="9.25"
            y="17.4"
            width="5.5"
            height="1.6"
            rx="0.8"
            fill="#bfadcc"
          />
        </svg>
        <span style={{ fontSize: 38, fontWeight: 600 }}>Orcanva</span>
      </div>
      <div
        style={{
          fontSize: title.length > LONG_TITLE ? 64 : 76,
          justifyContent: "center",
          letterSpacing: -2,
          lineHeight: 1,
          marginTop: 44,
          maxWidth: 1040,
          textAlign: "center",
        }}
      >
        {title}
      </div>
      {/* Full ink, as in the hero: the painting is too busy for muted text */}
      <div
        style={{
          fontFamily: "Instrument Sans",
          fontSize: 30,
          marginTop: 22,
        }}
      >
        {subtitle}
      </div>
    </div>,
    {
      ...SHARE_IMAGE_SIZE,
      fonts: [
        { data: figtreeMedium, name: "Figtree", style: "normal", weight: 500 },
        {
          data: figtreeSemiBold,
          name: "Figtree",
          style: "normal",
          weight: 600,
        },
        {
          data: instrumentSans,
          name: "Instrument Sans",
          style: "normal",
          weight: 400,
        },
      ],
    }
  );
