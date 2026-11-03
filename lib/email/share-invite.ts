import { escapeHtml, oneLine } from "@/lib/email/escape";
import { SITE_NAME } from "@/lib/site";

export interface ShareInvite {
  // Who shared it; null for an owner with no name on file
  ownerName: string | null;
  designName: string;
  // The address it's sent to
  email: string;
  // The invite link, absolute
  url: string;
  // Whether the address already has an account: if not, the email says to
  // create one with it
  hasAccount: boolean;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// Names come from people, so they're escaped for HTML and kept to one line
export const shareInviteEmail = ({
  designName,
  email,
  hasAccount,
  ownerName,
  url,
}: ShareInvite): EmailContent => {
  const who = oneLine(ownerName ?? "") || "Someone";
  const design = oneLine(designName);
  const subject = `${who} shared “${design}” with you`;
  const lead = `${who} invited you to edit “${design}” with them on ${SITE_NAME}.`;
  const next = hasAccount
    ? `Open it while signed in as ${email}.`
    : `${SITE_NAME} is a free design studio where people edit together, live. Create your account with ${email} to open it.`;
  const action = hasAccount ? "Open the design" : "Create your account";

  const text = [
    lead,
    "",
    next,
    "",
    `${action}: ${url}`,
    "",
    "If you weren't expecting this, you can ignore it.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;">
            <tr>
              <td style="font-size:14px;font-weight:600;color:#71717a;padding-bottom:24px;">${SITE_NAME}</td>
            </tr>
            <tr>
              <td style="font-size:20px;font-weight:600;line-height:1.4;padding-bottom:12px;">${escapeHtml(subject)}</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#3f3f46;padding-bottom:8px;">${escapeHtml(lead)}</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#3f3f46;padding-bottom:24px;">${escapeHtml(next)}</td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${escapeHtml(url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:10px;">${escapeHtml(action)}</a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#71717a;">If the button doesn't work, paste this into your browser:<br><a href="${escapeHtml(url)}" style="color:#71717a;word-break:break-all;">${escapeHtml(url)}</a></td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#a1a1aa;padding-top:24px;">If you weren't expecting this, you can ignore it.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

  return { html, subject, text };
};
