import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

// The landing's share card: the hero's watercolor with the wordmark and
// headline in its sky. Built once at build time. The image renderer takes no
// stylesheet and can't read WebP, so the painting is a 1200x630 JPEG crop of
// components/landing/assets/hero-landscape.webp, pinned to the top like the
// hero (redo it if the hero changes), and the colours and fonts are literal
// copies of the theme's (Figtree for headings, Instrument Sans for text).
export const alt = "Orcanva: Thumbnails worth the click.";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

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

// --foreground by day
const FOREGROUND = "#1f1322";

const OpengraphImage = () =>
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
        width={size.width}
        height={size.height}
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
          <path d="M5 13.5a7 7 0 0 1 14 0z" fill="#f19b89" />
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
          fontSize: 88,
          letterSpacing: -2,
          lineHeight: 1,
          marginTop: 44,
        }}
      >
        Thumbnails worth the click.
      </div>
      {/* Full ink, as in the hero: the painting is too busy for muted text */}
      <div
        style={{
          fontFamily: "Instrument Sans",
          fontSize: 30,
          marginTop: 22,
        }}
      >
        A calm editor for YouTube thumbnails and social images.
      </div>
    </div>,
    {
      ...size,
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

export default OpengraphImage;
