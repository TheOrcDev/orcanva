import { describe, expect, it } from "vitest";

import { commentMentionEmail } from "@/lib/email/comment-mention";

const JAY = "2b7d4c3a-1e9f-4a8b-b6c5-d4e3f2a1b0c9";
const MO = "8f1c0e1e-6c5d-4c71-9f7b-0b5a3a1d2e01";

const MENTION = {
  authorName: "Olga Owner",
  body: `<@${JAY}> can you make the title bigger?\nAsk <@${MO}> too`,
  designName: "Spring launch",
  mentions: { [JAY]: "Jay", [MO]: "Mo" },
  url: "https://www.orcanva.app/design/abc?comment=def",
};

describe("commentMentionEmail", () => {
  it("says who mentioned you where, and links to the thread", () => {
    const email = commentMentionEmail(MENTION);
    expect(email.subject).toBe("Olga Owner mentioned you on “Spring launch”");
    expect(email.text).toContain(
      "Open the comment: https://www.orcanva.app/design/abc?comment=def"
    );
    expect(email.html).toContain(
      'href="https://www.orcanva.app/design/abc?comment=def"'
    );
  });

  it("shows mention tokens as names", () => {
    const email = commentMentionEmail(MENTION);
    expect(email.text).toContain("> @Jay can you make the title bigger?");
    expect(email.text).toContain("> Ask @Mo too");
    expect(email.html).toContain("@Jay can you make the title bigger?");
    expect(email.html).not.toContain("&lt;@");
    expect(email.text).not.toContain("<@");
  });

  it("escapes everything people wrote", () => {
    const email = commentMentionEmail({
      ...MENTION,
      authorName: "Grom & <b>co</b>",
      body: '<img src=x onerror="alert(1)"> <a href="https://evil.example">x</a>',
      designName: "<script>alert(1)</script>",
      mentions: {},
    });
    expect(email.html).not.toContain("<img");
    expect(email.html).not.toContain("<script");
    expect(email.html).not.toContain('<a href="https://evil');
    expect(email.html).toContain("Grom &amp; &lt;b&gt;co&lt;/b&gt;");
  });

  it("keeps the subject to one line", () => {
    const email = commentMentionEmail({
      ...MENTION,
      authorName: "Olga\r\nBcc: someone@example.com",
      designName: "Spring\nlaunch",
    });
    expect(email.subject).not.toMatch(/[\r\n]/u);
    expect(email.subject).toBe(
      "Olga Bcc: someone@example.com mentioned you on “Spring launch”"
    );
  });

  it("quotes long comments only in part", () => {
    const email = commentMentionEmail({ ...MENTION, body: "a".repeat(2000) });
    expect(email.text).toContain(`${"a".repeat(499)}…`);
    expect(email.text).not.toContain("a".repeat(501));
  });

  it("falls back when the author has no name", () => {
    expect(
      commentMentionEmail({ ...MENTION, authorName: " \n " }).subject
    ).toBe("Someone mentioned you on “Spring launch”");
  });
});
