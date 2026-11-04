import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createFrameElement,
  createGraphicElement,
  createImageElement,
  createLinearElement,
  createTextElement,
} from "@/lib/document/factories";
import { rotatedBounds } from "@/lib/document/geometry";
import type { Rect, Size } from "@/lib/document/geometry";
import { migrateDocument } from "@/lib/document/migrate";
import { designDocumentSchema } from "@/lib/document/schema";
import type {
  DesignDocument,
  DesignElement,
  FrameElement,
  GraphicElement,
  ImageElement,
  LinearElement,
  RectElement,
  TextElement,
} from "@/lib/document/schema";
import { MAGIC_RESIZE_RULES, magicResize } from "@/lib/editor/magic-resize";
import { BUILTIN_GRAPHICS } from "@/lib/graphics/builtin";
import beforeAndAfter from "@/lib/templates/data/before-and-after.json";
import howToTutorial from "@/lib/templates/data/how-to-tutorial.json";
import paintWithMe from "@/lib/templates/data/paint-with-me.json";
import podcastEpisode from "@/lib/templates/data/podcast-episode.json";
import shockedReaction from "@/lib/templates/data/shocked-reaction.json";
import topTenList from "@/lib/templates/data/top-ten-list.json";
import versusSplit from "@/lib/templates/data/versus-split.json";
import { measureTextElement } from "@/lib/text/element-layout";
import type { Measurer } from "@/lib/text/layout";

// Every character is half the font size wide; the font box is 0.8 above
// the baseline and 0.2 below it
const measurer: Measurer = {
  fontBox: (style) => ({
    ascent: style.fontSize * 0.8,
    descent: style.fontSize * 0.2,
  }),
  width: (text, style) => [...text].length * style.fontSize * 0.5,
};
const measure = (text: TextElement) =>
  measureTextElement(text, measurer, () => true);

const THUMBNAIL = { height: 720, width: 1280 };
const SQUARE = { height: 1080, width: 1080 };
const STORY = { height: 1920, width: 1080 };
const X_POST = { height: 900, width: 1600 };
const BANNER = { height: 396, width: 1584 };
const TARGETS = [SQUARE, STORY, X_POST, BANNER];

const PHOTO = "8a5b3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const [ARROW_STICKER] = BUILTIN_GRAPHICS;

const byName = <T extends DesignElement>(
  document: DesignDocument,
  name: string
): T => {
  const element = document.elements.find((item) => item.name === name);
  if (!element) {
    throw new Error(`No ${name}`);
  }
  return element as T;
};

// What an element draws: a text's lines rather than its wrap width
const drawn = (element: DesignElement): Rect => {
  if (element.type !== "text") {
    return rotatedBounds(element);
  }
  const size = measure(element);
  return rotatedBounds(element, { height: size.height, width: size.inkWidth });
};

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

const inside = (box: Rect, page: Size, tolerance = 1) =>
  box.x >= -tolerance &&
  box.y >= -tolerance &&
  box.x + box.width <= page.width + tolerance &&
  box.y + box.height <= page.height + tolerance;

// A thumbnail with one of each thing the rules handle
const smokeDesign = (): DesignDocument => {
  const page = THUMBNAIL;
  const text = (overrides: Partial<TextElement>): TextElement => ({
    ...createTextElement("heading", page),
    align: "center",
    fontSize: 120,
    lineHeight: 1.1,
    shadow: {
      blurEm: 0.06,
      color: "#000000aa",
      offsetXEm: 0.02,
      offsetYEm: 0.04,
    },
    stroke: { color: "#111111", widthEm: 0.04 },
    ...overrides,
  });
  const photo: ImageElement = {
    ...createImageElement({ height: 720, id: PHOTO, width: 1280 }, page),
    height: 732,
    name: "Full-bleed photo",
    width: 1296,
    x: -8,
    y: -6,
  };
  const logo: GraphicElement = {
    ...createGraphicElement(ARROW_STICKER, page),
    height: 96,
    name: "Corner logo",
    width: 96,
    x: 36,
    y: 32,
  };
  const chip: RectElement = {
    ...(createBoxElement("rect", page) as RectElement),
    cornerRadius: 24,
    groupId: "chip",
    height: 80,
    name: "Chip",
    strokeWidth: 4,
    width: 230,
    x: 1010,
    y: 40,
  };
  const outlined: ImageElement = {
    ...createImageElement({ height: 300, id: PHOTO, width: 300 }, page),
    glow: { color: "#ffffff", size: 24 },
    name: "Photo with outline",
    outline: { color: "#ffffff", width: 10 },
    shadow: { blur: 20, color: "#00000080", offsetX: 6, offsetY: 10 },
    x: 900,
    y: 380,
  };
  const arrow: LinearElement = {
    ...createLinearElement("arrow", page),
    name: "Arrow",
    points: [0, 0, 170, -90],
    strokeWidth: 14,
    x: 120,
    y: 640,
  };
  const divider: LinearElement = {
    ...createLinearElement("line", page),
    name: "Divider",
    points: [0, 0, 1280, 0],
    strokeWidth: 6,
    x: 0,
    y: 690,
  };
  return {
    ...createDocument(page),
    elements: [
      photo,
      logo,
      text({
        name: "Centred title",
        text: "THE LAKE\nAT DAWN",
        width: 800,
        x: 240,
        y: 230,
      }),
      text({
        curve: 40,
        fontSize: 64,
        name: "Curved text",
        shadow: null,
        stroke: null,
        text: "a slow travel vlog",
        width: 500,
        x: 390,
        y: 20,
      }),
      arrow,
      divider,
      chip,
      text({
        fontSize: 52,
        groupId: "chip",
        name: "Chip text",
        shadow: null,
        stroke: null,
        text: "EP. 07",
        width: 230,
        x: 1010,
        y: 50,
      }),
      outlined,
    ],
  };
};

describe("magicResize", () => {
  it("returns the same layout at the same size", () => {
    const document = smokeDesign();
    expect(magicResize(document, THUMBNAIL, measure)).toBe(document);
  });

  it("scales everything evenly to a page of the same shape", () => {
    const document = smokeDesign();
    const resized = magicResize(document, X_POST, measure);
    for (const [index, element] of resized.elements.entries()) {
      const before = rotatedBounds(document.elements[index] as DesignElement);
      const after = rotatedBounds(element);
      expect(after.x).toBeCloseTo(before.x * 1.25, 0);
      expect(after.y).toBeCloseTo(before.y * 1.25, 0);
      expect(after.width).toBeCloseTo(before.width * 1.25, 0);
    }
    const title = byName<TextElement>(resized, "Centred title");
    expect(title.fontSize).toBeCloseTo(150);
    expect(title.width).toBeCloseTo(1000);
  });

  it("makes a full-bleed photo the new page, cropped rather than squashed", () => {
    const resized = magicResize(smokeDesign(), STORY, measure);
    const photo = byName<ImageElement>(resized, "Full-bleed photo");
    // The same bleed, as a share of the page
    expect(photo.x).toBeCloseTo((-8 / 1280) * 1080);
    expect(photo.y).toBeCloseTo((-6 / 720) * 1920);
    expect(photo.width).toBeCloseTo(1296 * (1080 / 1280));
    expect(photo.height).toBeCloseTo(732 * (1920 / 720));
    // What shows of the photo (drawn 1296 × 732 before) has the box's shape
    const crop = photo.crop ?? { height: 1, width: 1, x: 0, y: 0 };
    const shown = (crop.width * 1296) / (crop.height * 732);
    expect(shown).toBeCloseTo(photo.width / photo.height, 3);
    expect(crop.x + crop.width / 2).toBeCloseTo(0.5);
  });

  it("keeps a corner logo in its corner, its gap scaled by the smaller ratio", () => {
    const resized = magicResize(smokeDesign(), STORY, measure);
    const logo = byName<GraphicElement>(resized, "Corner logo");
    const lo = 1080 / 1280;
    expect(logo.x).toBeCloseTo(36 * lo);
    expect(logo.y).toBeCloseTo(32 * lo);
    expect(logo.width).toBeCloseTo(96 * lo);
    expect(logo.width).toBeCloseTo(logo.height);
  });

  it("keeps a centred title centred, growing its type and keeping it inside the margins", () => {
    for (const target of TARGETS) {
      const resized = magicResize(smokeDesign(), target, measure);
      const title = byName<TextElement>(resized, "Centred title");
      const box = drawn(title);
      expect(box.x + box.width / 2).toBeCloseTo(target.width / 2, 0);
      const margin =
        MAGIC_RESIZE_RULES.margin * Math.min(target.width, target.height);
      expect(box.x).toBeGreaterThanOrEqual(margin - 1);
      expect(box.height).toBeLessThanOrEqual(target.height - margin * 2 + 1);
      expect(title.width).toBeLessThanOrEqual(target.width - margin * 2 + 1);
      expect(measure(title).splitsWords).toBe(false);
    }
    const story = byName<TextElement>(
      magicResize(smokeDesign(), STORY, measure),
      "Centred title"
    );
    // Going taller, type grows with the page's area
    expect(story.fontSize).toBeGreaterThan(120);
  });

  it("shrinks text that would be too tall, down to a floor", () => {
    const resized = magicResize(smokeDesign(), BANNER, measure);
    const title = byName<TextElement>(resized, "Centred title");
    const lo = 396 / 720;
    expect(title.fontSize).toBeLessThan(120 * Math.sqrt(lo * (1584 / 1280)));
    expect(title.fontSize).toBeGreaterThanOrEqual(120 * lo - 1e-6);
  });

  it("fits curved text inside the page, keeping its curve and its centre", () => {
    for (const target of TARGETS) {
      const document = smokeDesign();
      const before = byName<TextElement>(document, "Curved text");
      const curved = byName<TextElement>(
        magicResize(document, target, measure),
        "Curved text"
      );
      expect(curved.curve).toBe(40);
      expect(curved.width / curved.fontSize).toBeCloseTo(
        before.width / before.fontSize
      );
      const margin =
        MAGIC_RESIZE_RULES.margin * Math.min(target.width, target.height);
      expect(measure(curved).width).toBeLessThanOrEqual(
        target.width - margin * 2 + 1
      );
      expect(inside(drawn(curved), target)).toBe(true);
    }
  });

  it("keeps an arrow's angle", () => {
    for (const target of TARGETS) {
      const arrow = byName<LinearElement>(
        magicResize(smokeDesign(), target, measure),
        "Arrow"
      );
      const [x1, y1, x2, y2] = arrow.points;
      expect(Math.atan2(y2 - y1, x2 - x1)).toBeCloseTo(Math.atan2(-90, 170));
    }
  });

  it("stretches a full-width divider across the new page", () => {
    for (const target of TARGETS) {
      const divider = byName<LinearElement>(
        magicResize(smokeDesign(), target, measure),
        "Divider"
      );
      const [x1, , x2] = divider.points;
      expect(divider.x + x1).toBeCloseTo(0);
      expect(divider.x + x2).toBeCloseTo(target.width);
      expect(divider.points[1]).toBe(divider.points[3]);
    }
  });

  it("moves a group as one, its members keeping their offsets", () => {
    const resized = magicResize(smokeDesign(), STORY, measure);
    const chip = byName<RectElement>(resized, "Chip");
    const label = byName<TextElement>(resized, "Chip text");
    const lo = 1080 / 1280;
    expect(label.x - chip.x).toBeCloseTo(0);
    expect(label.y - chip.y).toBeCloseTo(10 * lo);
    expect(label.fontSize).toBeCloseTo(52 * lo);
    expect(label.width).toBeCloseTo(230 * lo);
    // It stays in the top-right corner
    expect(chip.x + chip.width).toBeCloseTo(1080 - 40 * lo);
  });

  it("leaves sizes in em alone and scales sizes in px", () => {
    const document = smokeDesign();
    const resized = magicResize(document, STORY, measure);
    const title = byName<TextElement>(resized, "Centred title");
    expect(title.stroke).toEqual({ color: "#111111", widthEm: 0.04 });
    expect(title.shadow).toEqual(
      byName<TextElement>(document, "Centred title").shadow
    );
    const lo = 1080 / 1280;
    expect(byName<RectElement>(resized, "Chip").strokeWidth).toBeCloseTo(
      4 * lo
    );
    expect(byName<RectElement>(resized, "Chip").cornerRadius).toBeCloseTo(
      24 * lo
    );
    expect(byName<LinearElement>(resized, "Arrow").strokeWidth).toBeCloseTo(
      14 * lo
    );
    const photo = byName<ImageElement>(resized, "Photo with outline");
    expect(photo.outline?.width).toBeCloseTo(10 * lo);
    expect(photo.glow?.size).toBeCloseTo(24 * lo);
    expect(photo.shadow).toMatchObject({
      blur: expect.closeTo(20 * lo),
      offsetX: expect.closeTo(6 * lo),
      offsetY: expect.closeTo(10 * lo),
    });
    expect(photo.width).toBeCloseTo(photo.height);
  });

  it("refits a frame's photo when the frame becomes a panel", () => {
    const frame: FrameElement = {
      ...createFrameElement(THUMBNAIL, "square"),
      assetId: PHOTO,
      crop: { height: 1, width: 0.5, x: 0.25, y: 0 },
      height: 720,
      width: 640,
      x: 0,
      y: 0,
    };
    const document = { ...createDocument(THUMBNAIL), elements: [frame] };
    const [panel] = magicResize(document, STORY, measure).elements as [
      FrameElement,
    ];
    expect(panel).toMatchObject({ height: 1920, width: 540, x: 0, y: 0 });
    // The photo (2:1 on the page before) keeps its shape
    const crop = panel.crop ?? { height: 1, width: 1, x: 0, y: 0 };
    expect(540 / crop.width / (1920 / crop.height)).toBeCloseTo(
      640 / 0.5 / 720
    );
  });

  it("makes documents that parse", () => {
    for (const target of [...TARGETS, { height: 16, width: 4096 }]) {
      const parsed = designDocumentSchema.safeParse(
        magicResize(smokeDesign(), target, measure)
      );
      expect(parsed.success).toBe(true);
    }
  });
});

// Real templates, laid out again for the usual sizes: whatever was on the
// page stays on it, and nothing runs into a text that didn't before
const TEMPLATES = {
  "before-and-after": beforeAndAfter,
  "how-to-tutorial": howToTutorial,
  "paint-with-me": paintWithMe,
  "podcast-episode": podcastEpisode,
  "shocked-reaction": shockedReaction,
  "top-ten-list": topTenList,
  "versus-split": versusSplit,
};

describe("magicResize on templates", () => {
  for (const [id, template] of Object.entries(TEMPLATES)) {
    it(`lays out ${id} for a square, a story, an X post and a banner`, () => {
      const document = migrateDocument(template.document);
      for (const target of TARGETS) {
        const resized = magicResize(document, target, measure);
        expect(designDocumentSchema.safeParse(resized).success).toBe(true);
        for (const [index, element] of resized.elements.entries()) {
          const before = document.elements[index] as DesignElement;
          if (inside(drawn(before), document)) {
            expect(
              inside(drawn(element), target),
              `${element.name} stays on the page`
            ).toBe(true);
          }
          if (element.type !== "text" || !element.visible) {
            continue;
          }
          for (const [otherIndex, other] of resized.elements.entries()) {
            const otherBefore = document.elements[otherIndex] as DesignElement;
            const textOrPhoto =
              other.type === "text" ||
              other.type === "image" ||
              other.type === "frame";
            if (other.id === element.id || !textOrPhoto || !other.visible) {
              continue;
            }
            const share = (a: Rect, b: Rect) =>
              overlap(a, b) /
              Math.max(1, Math.min(a.width * a.height, b.width * b.height));
            const was = share(drawn(before), drawn(otherBefore));
            expect(
              share(drawn(element), drawn(other)),
              `${element.name} and ${other.name}`
            ).toBeLessThanOrEqual(was + 0.05);
          }
        }
      }
    });
  }

  it("keeps a template's title beside its photo going square", () => {
    const resized = magicResize(
      migrateDocument(shockedReaction.document),
      SQUARE,
      measure
    );
    const title = drawn(byName(resized, "I CAN'T"));
    const photo = drawn(byName(resized, "Your photo"));
    expect(title.x + title.width / 2).toBeLessThan(photo.x);
    expect(title.y).toBeLessThan(photo.y);
  });
});
