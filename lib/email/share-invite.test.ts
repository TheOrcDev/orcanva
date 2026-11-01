import { describe, expect, it } from "vitest";

import { escapeHtml, shareInviteEmail } from "@/lib/email/share-invite";

const INVITE = {
  designName: "Spring launch",
  email: "jay@example.com",
  hasAccount: true,
  ownerName: "Grom",
  url: "https://www.orcanva.app/invite/abc",
};

describe("shareInviteEmail", () => {
  it("says who shared what, and links to the invite", () => {
    const email = shareInviteEmail(INVITE);
    expect(email.subject).toBe("Grom shared “Spring launch” with you");
    expect(email.text).toContain(
      "Open the design: https://www.orcanva.app/invite/abc"
    );
    expect(email.html).toContain('href="https://www.orcanva.app/invite/abc"');
    expect(email.html).toContain("Open the design");
  });

  it("asks people without an account to create one with that email", () => {
    const email = shareInviteEmail({ ...INVITE, hasAccount: false });
    expect(email.text).toContain(
      "Create your account with jay@example.com to open it."
    );
    expect(email.text).toContain("Create your account: https://");
    expect(email.html).toContain("Create your account</a>");
    expect(email.html).not.toContain("Open the design");
  });

  it("escapes names, since people choose them", () => {
    const email = shareInviteEmail({
      ...INVITE,
      designName: '<img src=x onerror="alert(1)">',
      ownerName: "Grom & <b>co</b>",
    });
    expect(email.html).not.toContain("<img");
    expect(email.html).not.toContain("<b>");
    expect(email.html).toContain("Grom &amp; &lt;b&gt;co&lt;/b&gt;");
  });

  it("keeps the subject to one line", () => {
    const email = shareInviteEmail({
      ...INVITE,
      designName: "Spring\r\nBcc: someone@example.com",
    });
    expect(email.subject).not.toMatch(/[\r\n]/u);
  });

  it("falls back when the owner has no name", () => {
    expect(shareInviteEmail({ ...INVITE, ownerName: null }).subject).toBe(
      "Someone shared “Spring launch” with you"
    );
    expect(shareInviteEmail({ ...INVITE, ownerName: " \n " }).subject).toBe(
      "Someone shared “Spring launch” with you"
    );
  });
});

describe("escapeHtml", () => {
  it("escapes every character that's special in HTML", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
    );
  });
});
