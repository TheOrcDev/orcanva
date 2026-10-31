import { readFile } from "node:fs/promises";
import path from "node:path";

import { RiPaletteLine } from "@remixicon/react";
import { ImageResponse } from "next/og";

// The landing's share card: the hero's sunset, wordmark and headline. Built
// once at build time. The image renderer takes no stylesheet, so this file
// styles inline with the hero painting's colours.
export const alt = "Orcanva: Thumbnails worth the click.";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

// The renderer needs a static TTF or OTF, not next/font's variable WOFF2
const interMedium = await readFile(
  path.join(process.cwd(), "assets/fonts/Inter-Medium.ttf")
);

const INK = "#1b0624";

const OpengraphImage = () =>
  new ImageResponse(
    <div
      style={{
        alignItems: "center",
        backgroundImage:
          "linear-gradient(180deg, #f4ede8 0%, #f7e0d2 35%, #f5c7ae 60%, #ef9f80 80%)",
        color: INK,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter",
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
        <RiPaletteLine size={40} color={INK} />
        <span style={{ fontSize: 38, letterSpacing: -1 }}>Orcanva</span>
      </div>
      <div
        style={{
          fontSize: 88,
          letterSpacing: -4,
          lineHeight: 1,
          marginTop: 56,
        }}
      >
        Thumbnails worth the click.
      </div>
      <div
        style={{
          color: "#444444",
          fontSize: 30,
          letterSpacing: -0.3,
          marginTop: 28,
        }}
      >
        A calm editor for YouTube thumbnails and social images.
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { data: interMedium, name: "Inter", style: "normal", weight: 500 },
      ],
    }
  );

export default OpengraphImage;
