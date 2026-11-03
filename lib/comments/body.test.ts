import { describe, expect, it } from "vitest";

import {
  bodyParts,
  bodyText,
  checkBody,
  decodeMentions,
  encodeMentions,
  insertMention,
  matchPeople,
  mentionIds,
  mentionQueryAt,
  mentionToken,
  normalizeBody,
} from "@/lib/comments/body";
import { MAX_COMMENT_LENGTH, MAX_MENTIONS } from "@/lib/comments/limits";

const JAY = "2b7d4c3a-1e9f-4a8b-b6c5-d4e3f2a1b0c9";
const OLGA = "8f1c0e1e-6c5d-4c71-9f7b-0b5a3a1d2e01";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

describe("normalizeBody", () => {
  it("keeps line breaks and drops other control characters", () => {
    expect(normalizeBody("  one\r\ntwo\rthree\tfour\u0000\u001B[31m  ")).toBe(
      "one\ntwo\nthreefour[31m"
    );
  });

  it("composes accents the same way however they were typed", () => {
    expect(normalizeBody("café")).toBe("café");
    expect(normalizeBody("café").length).toBe(4);
  });
});

describe("checkBody", () => {
  it("refuses empty comments, also after trimming", () => {
    expect(checkBody(" \n\t ").ok).toBe(false);
  });

  it("allows up to the length limit", () => {
    expect(checkBody("a".repeat(MAX_COMMENT_LENGTH)).ok).toBe(true);
    expect(checkBody("a".repeat(MAX_COMMENT_LENGTH + 1))).toEqual({
      error: `A comment can be up to ${MAX_COMMENT_LENGTH} characters`,
      ok: false,
    });
  });

  it("lists who it mentions, and limits how many", () => {
    expect(
      checkBody(`Hi ${mentionToken(JAY)} and ${mentionToken(JAY)}`)
    ).toEqual({
      body: `Hi <@${JAY}> and <@${JAY}>`,
      mentions: [JAY],
      ok: true,
    });
    const many = Array.from({ length: MAX_MENTIONS + 1 }, (_, n) =>
      mentionToken(uuid(n))
    ).join(" ");
    expect(checkBody(many).ok).toBe(false);
  });
});

describe("mentions", () => {
  it("only reads well-formed tokens", () => {
    expect(
      mentionIds(`<@${OLGA}> <@not-a-uuid> <@${JAY.toUpperCase()}>`)
    ).toEqual([OLGA]);
  });

  it("shows tokens as names, and leaves unknown ones as typed", () => {
    const body = `Ask <@${JAY}>, not <@${OLGA}>!`;
    expect(bodyParts(body, { [JAY]: "Jay" })).toEqual([
      { kind: "text", text: "Ask " },
      { id: JAY, kind: "mention", name: "Jay" },
      { kind: "text", text: `, not <@${OLGA}>!` },
    ]);
    expect(bodyText(body, { [JAY]: "Jay", [OLGA]: "Olga" })).toBe(
      "Ask @Jay, not @Olga!"
    );
  });

  it("doesn't take names from the object's prototype", () => {
    const body = `<@${JAY}>`;
    expect(bodyText(body, {})).toBe(body);
  });
});

describe("composer mentions", () => {
  it("turns picked names into tokens, longest first", () => {
    const text = "@Jay Lee and @Jay, cc @Jayden and someone@Jay";
    expect(
      encodeMentions(text, [
        { id: JAY, name: "Jay" },
        { id: OLGA, name: "Jay Lee" },
      ])
    ).toBe(`<@${OLGA}> and <@${JAY}>, cc @Jayden and someone@Jay`);
  });

  it("treats names as text, not patterns", () => {
    expect(encodeMentions("@a.b and @axb", [{ id: JAY, name: "a.b" }])).toBe(
      `<@${JAY}> and @axb`
    );
  });

  it("goes back from tokens to names for editing", () => {
    expect(decodeMentions(`Hi <@${JAY}>`, { [JAY]: "Jay" })).toEqual({
      mentions: [{ id: JAY, name: "Jay" }],
      text: "Hi @Jay",
    });
  });

  it("finds the mention being typed at the caret", () => {
    expect(mentionQueryAt("Hi @ja", 6)).toEqual({ query: "ja", start: 3 });
    expect(mentionQueryAt("@", 1)).toEqual({ query: "", start: 0 });
    expect(mentionQueryAt("(@Jay Le", 8)).toEqual({
      query: "Jay Le",
      start: 1,
    });
    expect(mentionQueryAt("me@ja", 5)).toBeNull();
    expect(mentionQueryAt("@ja\nmore", 8)).toBeNull();
    expect(mentionQueryAt("@ hello", 7)).toBeNull();
    expect(mentionQueryAt("no at", 5)).toBeNull();
  });

  it("puts the picked name in place of what was typed", () => {
    expect(insertMention("Hi @ja there", { end: 6, start: 3 }, "Jay")).toEqual({
      caret: 8,
      text: "Hi @Jay there",
    });
  });

  it("matches people by the start of their name, then of a word", () => {
    const people = [
      { name: "Olga Owner" },
      { name: "Jay" },
      { name: "Mo Jones" },
    ];
    expect(matchPeople(people, "jo")).toEqual([{ name: "Mo Jones" }]);
    expect(matchPeople(people, "j")).toEqual([
      { name: "Jay" },
      { name: "Mo Jones" },
    ]);
    expect(matchPeople(people, "", 2)).toEqual(people.slice(0, 2));
  });
});
