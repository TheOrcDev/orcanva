import { describe, expect, it } from "vitest";

import {
  avatarSrc,
  formatContributions,
  parseContributors,
  totalContributions,
} from "@/lib/contributors";

const entry = (login: string, contributions: number) => ({
  avatar_url: `https://avatars.githubusercontent.com/u/${contributions}?v=4`,
  contributions,
  html_url: `https://github.com/${login}`,
  login,
  type: "User",
});

describe("parseContributors", () => {
  it("lists the most contributions first", () => {
    const contributors = parseContributors([
      entry("few", 1),
      entry("most", 200),
      entry("some", 3),
    ]);
    expect(contributors.map((contributor) => contributor.login)).toEqual([
      "most",
      "some",
      "few",
    ]);
    expect(contributors[0]).toEqual({
      avatarUrl: "https://avatars.githubusercontent.com/u/200?v=4",
      contributions: 200,
      login: "most",
      profileUrl: "https://github.com/most",
    });
  });

  it("skips entries that aren't whole contributors", () => {
    const contributors = parseContributors([
      entry("kept", 2),
      { contributions: 5, login: "no-avatar" },
      { ...entry("negative", 1), contributions: -1 },
      null,
    ]);
    expect(contributors.map((contributor) => contributor.login)).toEqual([
      "kept",
    ]);
  });

  it("is empty for anything but a list, such as a rate-limit error", () => {
    expect(parseContributors({ message: "API rate limit exceeded" })).toEqual(
      []
    );
  });
});

describe("totalContributions", () => {
  it("adds up everyone's contributions", () => {
    const contributors = parseContributors([entry("a", 200), entry("b", 7)]);
    expect(totalContributions(contributors)).toBe(207);
    expect(totalContributions([])).toBe(0);
  });
});

describe("formatContributions", () => {
  it("counts in the singular only for one", () => {
    expect(formatContributions(1)).toBe("1 contribution");
    expect(formatContributions(0)).toBe("0 contributions");
    expect(formatContributions(2396)).toBe("2,396 contributions");
  });
});

describe("avatarSrc", () => {
  it("asks GitHub for the avatar at twice the card's size", () => {
    expect(
      avatarSrc("https://avatars.githubusercontent.com/u/7549938?v=4")
    ).toBe("https://avatars.githubusercontent.com/u/7549938?v=4&s=96");
  });
});
