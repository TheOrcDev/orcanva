import { describe, expect, it } from "vitest";

import { elementSchema } from "@/lib/document/schema";
import { normalizeSvg, parseTransform } from "@/lib/graphics/normalize";

const OPTIONS = { currentColor: "#111111" };

// As Tabler ships its outline icons: paint set once on <svg>, inherited by
// every path, and a box path that paints nothing
const TABLER_ARROW = `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"
>
  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
  <path d="M5 12l14 0" />
  <path d="M13 18l6 -6" />
  <path d="M13 6l6 6" />
</svg>`;

// As Fluent's flat emoji look: a fill per path in five colours, named and
// upper-case among them
const FLUENT_FACE = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M29.9978 15.9989C29.9978 23.7303 25.3333 29.9978 15.9989 29.9978C6.66443 29.9978 2 23.7303 2 15.9989C2 8.26751 6.66443 2 15.9989 2C25.3333 2 29.9978 8.26751 29.9978 15.9989Z" fill="#FFB02E"/>
<path d="M10.5 16C12.9853 16 15 13.9853 15 11.5C15 9.01472 12.9853 7 10.5 7C8.01472 7 6 9.01472 6 11.5C6 13.9853 8.01472 16 10.5 16Z" fill="white"/>
<path d="M21.5 16C23.9853 16 26 13.9853 26 11.5C26 9.01472 23.9853 7 21.5 7C19.0147 7 17 9.01472 17 11.5C17 13.9853 19.0147 16 21.5 16Z" fill="white"/>
<circle cx="11" cy="11.5" r="2" fill="#402A32"/>
<circle cx="21" cy="11.5" r="2" fill="#402a32"/>
<path d="M13 21C13 19.3431 14.3431 18 16 18C17.6569 18 19 19.3431 19 21V24C19 25.6569 17.6569 27 16 27C14.3431 27 13 25.6569 13 24V21Z" fill="#BB1D80"/>
<g opacity="0.5"><ellipse cx="6" cy="20" rx="2" ry="1.5" fill="#FF6723"/></g>
</svg>`;

describe("normalizeSvg", () => {
  it("gives Tabler's outline icons the paint they inherit from <svg>", () => {
    const art = normalizeSvg(TABLER_ARROW, OPTIONS);
    expect(art.viewBox).toEqual([0, 0, 24, 24]);
    expect(art.palette).toEqual(["#111111"]);
    // The box paints nothing; the three strokes become one layer
    expect(art.layers).toEqual([
      {
        d: "M5 12l14 0M13 18l6-6M13 6l6 6",
        fill: null,
        fillRule: "nonzero",
        lineCap: "round",
        lineJoin: "round",
        opacity: 1,
        stroke: 0,
        strokeWidth: 2,
      },
    ]);
  });

  it("collects a Fluent emoji's colours into a palette, once each", () => {
    const art = normalizeSvg(FLUENT_FACE, OPTIONS);
    expect(art.palette).toEqual([
      "#ffb02e",
      "#ffffff",
      "#402a32",
      "#bb1d80",
      "#ff6723",
    ]);
    expect(art.layers.map((layer) => layer.fill)).toEqual([
      0, 1, 1, 2, 2, 3, 4,
    ]);
    // A group's opacity reaches its shapes
    expect(art.layers.at(-1)?.opacity).toBe(0.5);
    // Shapes became paths
    expect(art.layers[3]?.d).toMatch(/^M9 11\.5a2 2 0 1 0 4 0/u);
  });

  it("rounds coordinates to two decimals, written compactly", () => {
    const art = normalizeSvg(FLUENT_FACE, OPTIONS);
    for (const layer of art.layers) {
      expect(layer.d).not.toMatch(/\d\.\d{3}/u);
      expect(layer.d).not.toMatch(/(?:^|[^\d])0\.\d/u);
    }
    expect(art.layers[0]?.d.startsWith("M30 16c0 7.73-4.66 14-14 14")).toBe(
      true
    );
  });

  it("makes art an element accepts", () => {
    const art = normalizeSvg(FLUENT_FACE, OPTIONS);
    const element = {
      flipX: false,
      flipY: false,
      groupId: null,
      height: 100,
      id: "g",
      kind: "emoji",
      locked: false,
      name: "Face",
      opacity: 1,
      outline: null,
      rotation: 0,
      source: "fluent:face",
      strokeScale: 1,
      type: "graphic",
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      ...art,
    };
    expect(elementSchema.safeParse(element).success).toBe(true);
  });

  it("applies transforms to the path and to stroke widths", () => {
    const art = normalizeSvg(
      `<svg viewBox="0 0 100 100"><g transform="translate(10 20) scale(2)">
        <rect width="10" height="5" fill="red" stroke="blue" stroke-width="3"/>
      </g></svg>`,
      OPTIONS
    );
    expect(art.layers).toMatchObject([
      { d: "M10 20h20v10h-20z", fill: 0, stroke: 1, strokeWidth: 6 },
    ]);
    expect(art.palette).toEqual(["#ff0000", "#0000ff"]);
  });

  it("turns every basic shape into a path", () => {
    const art = normalizeSvg(
      `<svg viewBox="0 0 40 40" fill="#000">
        <rect x="1" y="1" width="10" height="10" rx="2"/>
        <line x1="0" y1="0" x2="5" y2="5" stroke="#000"/>
        <polyline points="0,0 5,5 10,0" fill="none" stroke="#000"/>
        <polygon points="0 0 5 5 10 0"/>
        <ellipse cx="20" cy="20" rx="5" ry="3"/>
      </svg>`,
      OPTIONS
    );
    expect(art.layers.map((layer) => layer.d)).toEqual([
      "M3 1h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z",
      "M0 0l5 5",
      "M0 0l5 5 5-5",
      "M0 0l5 5 5-5z",
      "M15 20a5 3 0 1 0 10 0 5 3 0 1 0-10 0z",
    ]);
    // The line has no fill area, and the polyline asked for none
    expect(art.layers[1]).toMatchObject({ fill: 0, stroke: 0 });
    expect(art.layers[2]).toMatchObject({ fill: null, stroke: 0 });
  });

  it("splits a fill and a stroke that fade differently", () => {
    const art = normalizeSvg(
      `<svg viewBox="0 0 10 10"><path d="M0 0h5v5z" fill="#fff" fill-opacity="0.5" stroke="#000"/></svg>`,
      OPTIONS
    );
    expect(art.layers).toMatchObject([
      { fill: 0, opacity: 0.5, stroke: null },
      { fill: null, opacity: 1, stroke: 1, strokeWidth: 1 },
    ]);
  });

  it("refuses what flat paths can't draw", () => {
    const refusals: [string, string][] = [
      [
        `<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><path d="M0 0h5v5z" fill="url(#g)"/></svg>`,
        "gradients",
      ],
      [
        `<svg viewBox="0 0 10 10"><path d="M0 0h5v5z" fill="url(#p)"/></svg>`,
        "paint servers",
      ],
      [
        `<svg viewBox="0 0 10 10"><g clip-path="url(#c)"><path d="M0 0h5v5z"/></g></svg>`,
        "clip paths",
      ],
      [
        `<svg viewBox="0 0 10 10"><mask id="m"/><path d="M0 0h5v5z"/></svg>`,
        "masks",
      ],
      [`<svg viewBox="0 0 10 10"><text x="0" y="5">Hi</text></svg>`, "text"],
      [`<svg viewBox="0 0 10 10"><use href="#a"/></svg>`, "use"],
      [`<svg viewBox="0 0 10 10"><image href="a.png"/></svg>`, "images"],
      [
        `<svg viewBox="0 0 10 10"><path d="M0 0h5" filter="url(#f)"/></svg>`,
        "filters",
      ],
      [
        `<svg viewBox="0 0 10 10"><path d="M0 0h5" fill="none"/></svg>`,
        "nothing to draw",
      ],
      [`<svg><path d="M0 0h5v5z"/></svg>`, "no size"],
      ["<div></div>", "no <svg>"],
      ["not svg at all", "unreadable SVG"],
    ];
    for (const [svg, reason] of refusals) {
      expect(() => normalizeSvg(svg, OPTIONS)).toThrow(reason);
    }
  });

  it("refuses art with more colours than a palette holds", () => {
    const paths = Array.from(
      { length: 17 },
      (_, index) =>
        `<path d="M${index} 0h1v1z" fill="#${index.toString(16).padStart(2, "0")}0000"/>`
    ).join("");
    expect(() =>
      normalizeSvg(`<svg viewBox="0 0 20 2">${paths}</svg>`, OPTIONS)
    ).toThrow("more than 16 colours");
  });
});

describe("parseTransform", () => {
  it("reads transform lists in order", () => {
    expect(parseTransform("translate(10 20) scale(2)")).toEqual([
      2, 0, 0, 2, 10, 20,
    ]);
    const [a, b, c, d, e, f] = parseTransform("rotate(90 5 5)");
    expect([a, b, c, d].map((value) => Math.round(value))).toEqual([
      0, 1, -1, 0,
    ]);
    expect([e, f].map((value) => Math.round(value))).toEqual([10, 0]);
  });
});
