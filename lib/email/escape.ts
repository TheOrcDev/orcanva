// Making people's text safe for an email

const HTML_ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

const HTML_SPECIAL = /["&'<>]/gu;

export const escapeHtml = (value: string): string =>
  value.replaceAll(HTML_SPECIAL, (char) => HTML_ESCAPES[char] ?? char);

// Line breaks and other control characters, which have no place in a
// subject line
const CONTROL = /\p{Cc}+/gu;

export const oneLine = (value: string): string =>
  value.replaceAll(CONTROL, " ").trim();
