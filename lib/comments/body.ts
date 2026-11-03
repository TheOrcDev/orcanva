import { MAX_COMMENT_LENGTH, MAX_MENTIONS } from "@/lib/comments/limits";

// A comment's text is stored as written, plain: no HTML, no markup. People
// it mentions are <@user id> tokens, shown as "@Name" from the comment's
// `mentions` (names as they were when it was written).

const MENTION =
  /<@(?<id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>/gu;

const LINE_BREAK = /\r\n?/gu;

// Control characters other than the line break: tabs, escapes, NUL, …
const CONTROL = /(?!\n)\p{Cc}/gu;

export const mentionToken = (userId: string): string => `<@${userId}>`;

// The same text whichever way it was typed or pasted
export const normalizeBody = (raw: string): string =>
  raw
    .replaceAll(LINE_BREAK, "\n")
    .normalize("NFC")
    .replaceAll(CONTROL, "")
    .trim();

// Everyone it mentions, once each, in order
export const mentionIds = (body: string): string[] => [
  ...new Set(
    [...body.matchAll(MENTION)].map((match) => match.groups?.id ?? "")
  ),
];

export type BodyCheck =
  | { ok: true; body: string; mentions: string[] }
  | { ok: false; error: string };

// What gets stored, or why it can't be
export const checkBody = (raw: string): BodyCheck => {
  const body = normalizeBody(raw);
  if (body === "") {
    return { error: "Write something first", ok: false };
  }
  if (body.length > MAX_COMMENT_LENGTH) {
    return {
      error: `A comment can be up to ${MAX_COMMENT_LENGTH} characters`,
      ok: false,
    };
  }
  const mentions = mentionIds(body);
  if (mentions.length > MAX_MENTIONS) {
    return {
      error: `A comment can mention up to ${MAX_MENTIONS} people`,
      ok: false,
    };
  }
  return { body, mentions, ok: true };
};

export type BodyPart =
  | { kind: "text"; text: string }
  | { kind: "mention"; id: string; name: string };

// The text with its mentions picked out, for drawing them as names. A token
// for someone it doesn't name stays as typed.
export const bodyParts = (
  body: string,
  names: Readonly<Record<string, string>>
): BodyPart[] => {
  const parts: BodyPart[] = [];
  let text = "";
  let index = 0;
  for (const match of body.matchAll(MENTION)) {
    const id = match.groups?.id ?? "";
    const name = Object.hasOwn(names, id) ? names[id] : undefined;
    if (name === undefined) {
      continue;
    }
    text += body.slice(index, match.index);
    if (text) {
      parts.push({ kind: "text", text });
      text = "";
    }
    parts.push({ id, kind: "mention", name });
    index = match.index + match[0].length;
  }
  text += body.slice(index);
  if (text) {
    parts.push({ kind: "text", text });
  }
  return parts;
};

// Plain text with each mention as "@Name" (emails, previews)
export const bodyText = (
  body: string,
  names: Readonly<Record<string, string>>
): string =>
  bodyParts(body, names)
    .map((part) => (part.kind === "text" ? part.text : `@${part.name}`))
    .join("");

// Someone picked from the composer's list; the text shows "@Name"
export interface ComposerMention {
  id: string;
  name: string;
}

const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/gu;

const escapeRegExp = (value: string) =>
  value.replaceAll(REGEXP_SPECIAL, String.raw`\$&`);

// Turns the composer's text into a body: every "@Name" of someone picked
// from the list becomes their token, unless it runs into a longer word
export const encodeMentions = (
  text: string,
  mentions: readonly ComposerMention[]
): string => {
  const byName = new Map<string, string>();
  for (const mention of mentions) {
    if (mention.name && !byName.has(mention.name)) {
      byName.set(mention.name, mention.id);
    }
  }
  if (byName.size === 0) {
    return text;
  }
  // Longest first, so "@Jay Lee" wins over "@Jay"
  const names = [...byName.keys()]
    .toSorted((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])@(?<name>${names.join("|")})(?![\\p{L}\\p{N}_])`,
    "gu"
  );
  let encoded = "";
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const id = byName.get(match.groups?.name ?? "");
    if (id) {
      encoded += `${text.slice(index, match.index)}${mentionToken(id)}`;
      index = match.index + match[0].length;
    }
  }
  return `${encoded}${text.slice(index)}`;
};

// The other way, for editing a comment: its text with "@Name"s, and who
// they are
export const decodeMentions = (
  body: string,
  names: Readonly<Record<string, string>>
): { text: string; mentions: ComposerMention[] } => {
  const mentions = new Map<string, ComposerMention>();
  for (const part of bodyParts(body, names)) {
    if (part.kind === "mention") {
      mentions.set(part.id, { id: part.id, name: part.name });
    }
  }
  return { mentions: [...mentions.values()], text: bodyText(body, names) };
};

// How far back from the caret an "@" can start a mention being typed
const MAX_QUERY_LENGTH = 40;

// Characters an "@" may follow to start a mention
const BEFORE_MENTION = /[\s([{"'“‘]/u;

// The mention being typed at the caret: where its "@" is and what follows
// it. Null when the caret isn't in one.
export const mentionQueryAt = (
  text: string,
  caret: number
): { start: number; query: string } | null => {
  const from = Math.max(0, caret - MAX_QUERY_LENGTH - 1);
  const start = text.lastIndexOf("@", caret - 1);
  if (start < from || start === -1) {
    return null;
  }
  const before = start > 0 ? text[start - 1] : undefined;
  if (before !== undefined && !BEFORE_MENTION.test(before)) {
    return null;
  }
  const query = text.slice(start + 1, caret);
  if (query.includes("\n") || query.startsWith(" ") || query.includes("  ")) {
    return null;
  }
  return { query, start };
};

// Replaces the "@query" being typed with the picked person's "@Name "
export const insertMention = (
  text: string,
  at: { start: number; end: number },
  name: string
): { text: string; caret: number } => {
  const inserted = `@${name} `;
  return {
    caret: at.start + inserted.length,
    text: `${text.slice(0, at.start)}${inserted}${text.slice(at.end).replace(/^ /u, "")}`,
  };
};

// The people whose names match what's typed after "@": names starting with
// it first, then ones with a word starting with it
export const matchPeople = <Person extends { name: string }>(
  people: readonly Person[],
  query: string,
  limit = 6
): Person[] => {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === "") {
    return people.slice(0, limit);
  }
  const starts: Person[] = [];
  const words: Person[] = [];
  for (const person of people) {
    const name = person.name.toLocaleLowerCase();
    if (name.startsWith(needle)) {
      starts.push(person);
    } else if (name.split(/\s+/u).some((word) => word.startsWith(needle))) {
      words.push(person);
    }
  }
  return [...starts, ...words].slice(0, limit);
};
