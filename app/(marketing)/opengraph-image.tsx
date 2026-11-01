import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

// The landing's share card: the hero's sunset, wordmark and headline. Built
// once at build time. The image renderer takes no stylesheet, so this file
// styles inline with literal copies of the theme's colours and fonts
// (Figtree for headings, Instrument Sans for text).
export const alt = "Orcanva: Thumbnails worth the click.";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

// The renderer needs static TTFs or OTFs, not next/font's variable WOFF2
const font = (file: string) =>
  readFile(path.join(process.cwd(), "assets/fonts", file));
const [figtreeMedium, figtreeSemiBold, instrumentSans] = await Promise.all([
  font("Figtree-Medium.ttf"),
  font("Figtree-SemiBold.ttf"),
  font("InstrumentSans-Regular.ttf"),
]);

// --foreground and --muted-foreground by day
const FOREGROUND = "#1f1322";
const MUTED_FOREGROUND = "#6c5d70";

const OpengraphImage = () =>
  new ImageResponse(
    <div
      style={{
        alignItems: "center",
        backgroundImage:
          "linear-gradient(180deg, #f4ede8 0%, #f7e0d2 35%, #f5c7ae 60%, #ef9f80 80%)",
        color: FOREGROUND,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Figtree",
        height: "100%",
        paddingTop: 72,
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 100%, #fff3dc 0%, #fcd5a9 30%, rgba(247, 196, 166, 0) 70%)",
          bottom: 0,
          display: "flex",
          height: 520,
          left: 0,
          position: "absolute",
          width: "100%",
        }}
      />
      <svg
        width="1200"
        height="250"
        viewBox="0 0 1200 250"
        style={{ bottom: 0, left: 0, position: "absolute" }}
      >
        <circle cx="600" cy="150" r="58" fill="#fff4df" />
        <path
          d="M0 120 C 160 50 300 40 450 95 S 760 150 900 70 S 1110 40 1200 80 V250 H0 Z"
          fill="#d4afb6"
        />
        <path
          d="M0 175 C 190 115 360 150 530 180 S 860 140 1010 120 S 1150 150 1200 145 V250 H0 Z"
          fill="#a98aa2"
        />
        <rect x="0" y="200" width="1200" height="50" fill="#ecc4b4" />
        <rect x="430" y="214" width="340" height="3" fill="#fbe8dd" />
        <rect x="500" y="228" width="200" height="3" fill="#fbe8dd" />
      </svg>
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
          marginTop: 56,
        }}
      >
        Thumbnails worth the click.
      </div>
      <div
        style={{
          color: MUTED_FOREGROUND,
          fontFamily: "Instrument Sans",
          fontSize: 30,
          marginTop: 28,
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
