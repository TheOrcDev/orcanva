import { describe, expect, it } from "vitest";

import { parseFontFaces } from "@/lib/fonts/loader";

// Trimmed shape of a real fonts.googleapis.com/css2 response
const GOOGLE_CSS = `
/* latin-ext */
@font-face {
  font-family: 'Anton';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(https://fonts.gstatic.com/s/anton/v26/1Ptgg87LROyAm3K9-C8QSw.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5;
}
/* latin */
@font-face {
  font-family: 'Anton';
  font-style: italic;
  font-weight: 700;
  font-display: block;
  src: url(https://fonts.gstatic.com/s/anton/v26/1Ptgg87LROyAm3K9-C8QSw0.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}
@font-face { font-style: normal; }
`;

describe("parseFontFaces", () => {
  it("reads every complete @font-face rule", () => {
    const faces = parseFontFaces(GOOGLE_CSS);
    expect(faces).toHaveLength(2);
    expect(faces[0]).toEqual({
      family: "Anton",
      src: "url(https://fonts.gstatic.com/s/anton/v26/1Ptgg87LROyAm3K9-C8QSw.woff2) format('woff2')",
      style: "normal",
      unicodeRange: "U+0100-02BA, U+02BD-02C5",
      weight: "400",
    });
    expect(faces[1]).toMatchObject({ style: "italic", weight: "700" });
  });

  it("ignores rules without a family or source", () => {
    expect(parseFontFaces("@font-face { font-family: 'X'; }")).toEqual([]);
  });
});
