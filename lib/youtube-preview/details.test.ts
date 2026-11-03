import { describe, expect, it } from "vitest";

import {
  DEFAULT_DETAILS,
  MAX_SAVED_TITLES,
  MAX_TITLE,
  PREVIEW_DETAILS_KEY,
  PREVIEW_TITLES_KEY,
  clampTitle,
  loadDetails,
  loadTitle,
  normalizeDuration,
  parseDetails,
  parseTitles,
  saveDetails,
  saveTitle,
  withTitle,
} from "@/lib/youtube-preview/details";

// Enough of localStorage for these tests
const memoryStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  } as Storage;
};

const brokenStorage = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("full");
  },
} as unknown as Storage;

const AVATAR = "data:image/jpeg;base64,/9j/4AAQ";
const DESIGN_A = "6b1f1d0e-4c4f-4d0b-9a57-1f1c0c6a0a01";
const DESIGN_B = "6b1f1d0e-4c4f-4d0b-9a57-1f1c0c6a0a02";
const designIdAt = (index: number) =>
  `6b1f1d0e-4c4f-4d0b-9a57-${index.toString(16).padStart(12, "0")}`;

describe("normalizeDuration", () => {
  it("writes lengths the way the badge does", () => {
    expect(normalizeDuration("12:34")).toBe("12:34");
    expect(normalizeDuration(" 05:07 ")).toBe("5:07");
    expect(normalizeDuration("0:45")).toBe("0:45");
    expect(normalizeDuration("1:02:03")).toBe("1:02:03");
    expect(normalizeDuration("01:02:03")).toBe("1:02:03");
  });

  it("reads minutes alone, and rolls long minutes into hours", () => {
    expect(normalizeDuration("8")).toBe("8:00");
    expect(normalizeDuration("75:00")).toBe("1:15:00");
    expect(normalizeDuration("90")).toBe("1:30:00");
  });

  it("refuses what isn't a length", () => {
    for (const input of [
      "",
      "abc",
      "12:3",
      "1:75",
      "1:60:00",
      "1:02:03:04",
      "-1:00",
      "12.34",
      "100:00:00",
    ]) {
      expect(normalizeDuration(input)).toBeNull();
    }
    expect(normalizeDuration("99:59:59")).toBe("99:59:59");
  });
});

describe("clampTitle", () => {
  it("keeps titles within the limit as they are", () => {
    expect(clampTitle("")).toBe("");
    expect(clampTitle("My video ")).toBe("My video ");
    const full = "a".repeat(MAX_TITLE);
    expect(clampTitle(full)).toBe(full);
  });

  it("cuts longer titles", () => {
    expect(clampTitle("b".repeat(MAX_TITLE + 20))).toBe("b".repeat(MAX_TITLE));
  });

  it("doesn't leave half an emoji", () => {
    // The 100th code unit is the first half of the orc
    const title = `${"c".repeat(MAX_TITLE - 1)}👹 more`;
    expect(clampTitle(title)).toBe("c".repeat(MAX_TITLE - 1));
    const fits = `${"c".repeat(MAX_TITLE - 2)}👹`;
    expect(clampTitle(`${fits}!`)).toBe(fits);
  });
});

describe("saved details", () => {
  it("reads what was saved", () => {
    const details = {
      avatar: AVATAR,
      badgeGuide: true,
      channel: "Orc Painter",
      corner: true,
      duration: "1:02:03",
      theme: "dark",
    } as const;
    expect(parseDetails(details)).toEqual(details);
  });

  it("falls back field by field", () => {
    expect(
      parseDetails({
        avatar: "https://example.com/me.png",
        badgeGuide: "yes",
        channel: 42,
        corner: 1,
        duration: "soon",
        theme: "sepia",
      })
    ).toEqual(DEFAULT_DETAILS);
    expect(
      parseDetails({ avatar: `data:image/jpeg;base64,${"a".repeat(100_000)}` })
        .avatar
    ).toBeNull();
    expect(parseDetails({ channel: "x".repeat(61) }).channel).toBe("");
    expect(parseDetails({ theme: "dark" })).toEqual({
      ...DEFAULT_DETAILS,
      theme: "dark",
    });
    expect(parseDetails({ channel: "  Spaced  " }).channel).toBe("Spaced");
  });

  it("survives whatever was stored", () => {
    for (const value of [undefined, null, "text", 12, [1, 2]]) {
      expect(parseDetails(value)).toEqual(DEFAULT_DETAILS);
    }
    const storage = memoryStorage({ [PREVIEW_DETAILS_KEY]: "{" });
    expect(loadDetails(storage)).toEqual(DEFAULT_DETAILS);
    expect(loadDetails(brokenStorage)).toEqual(DEFAULT_DETAILS);
    expect(loadDetails()).toEqual(DEFAULT_DETAILS);
  });

  it("keeps details in storage", () => {
    const storage = memoryStorage();
    const details = { ...DEFAULT_DETAILS, channel: "Swamp Studio" };
    saveDetails(details, storage);
    expect(loadDetails(storage)).toEqual(details);
    expect(() => saveDetails(details, brokenStorage)).not.toThrow();
  });
});

describe("saved titles", () => {
  it("keeps only readable entries", () => {
    expect(
      parseTitles({
        [DESIGN_A]: "Fine",
        [DESIGN_B]: "x".repeat(MAX_TITLE + 1),
        "not-a-design": "Dropped",
        [designIdAt(3)]: 7,
      })
    ).toEqual({ [DESIGN_A]: "Fine" });
    for (const value of [undefined, null, "text", [DESIGN_A]]) {
      expect(parseTitles(value)).toEqual({});
    }
  });

  it("puts the latest title last, and forgets the oldest", () => {
    const titles = withTitle(
      { [DESIGN_A]: "Old", [DESIGN_B]: "B" },
      DESIGN_A,
      "New"
    );
    expect(Object.entries(titles)).toEqual([
      [DESIGN_B, "B"],
      [DESIGN_A, "New"],
    ]);
    expect(withTitle(titles, DESIGN_A, "")).toEqual({ [DESIGN_B]: "B" });

    let many = {};
    for (let index = 0; index < MAX_SAVED_TITLES + 5; index += 1) {
      many = withTitle(many, designIdAt(index), `Title ${index}`);
    }
    expect(Object.keys(many)).toHaveLength(MAX_SAVED_TITLES);
    expect(many).not.toHaveProperty(designIdAt(4));
    expect(many).toHaveProperty(designIdAt(5), "Title 5");
  });

  it("keeps titles in storage", () => {
    const storage = memoryStorage({ [PREVIEW_TITLES_KEY]: "garbage" });
    expect(loadTitle(DESIGN_A, storage)).toBe("");
    saveTitle(DESIGN_A, "First", storage);
    saveTitle(DESIGN_B, "Second", storage);
    expect(loadTitle(DESIGN_A, storage)).toBe("First");
    expect(loadTitle(DESIGN_B, storage)).toBe("Second");
    expect(loadTitle(DESIGN_A, brokenStorage)).toBe("");
    expect(() => saveTitle(DESIGN_A, "x", brokenStorage)).not.toThrow();
  });
});
