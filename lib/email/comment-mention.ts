import { bodyText } from "@/lib/comments/body";
import { escapeHtml, oneLine } from "@/lib/email/escape";
import type { EmailContent } from "@/lib/email/share-invite";
import { SITE_NAME } from "@/lib/site";

export interface CommentMention {
  // Who wrote the comment, and on which design
  authorName: string;
  designName: string;
  // The comment as stored: plain text with <@user id> tokens, and the names
  // they stand for
  body: string;
  mentions: Readonly<Record<string, string>>;
  // The comment's thread, absolute
  url: string;
}

// How much of the comment the email quotes
const QUOTE_LENGTH = 500;

const quote = (text: string) =>
  text.length > QUOTE_LENGTH ? `${text.slice(0, QUOTE_LENGTH - 1)}…` : text;

// The email someone gets when a comment mentions them. Everything in it
// comes from people, so names are kept to one line and all of it is
// escaped; the comment is quoted as plain text with mentions as "@Name".
export const commentMentionEmail = ({
  authorName,
  body,
  designName,
  mentions,
  url,
}: CommentMention): EmailContent => {
  const who = oneLine(authorName) || "Someone";
  const design = oneLine(designName);
  const subject = `${who} mentioned you on “${design}”`;
  const lead = `${who} mentioned you in a comment on “${design}” in ${SITE_NAME}:`;
  const said = quote(bodyText(body, mentions));
  const action = "Open the comment";

  const text = [
    lead,
    "",
    ...said.split("\n").map((line) => `> ${line}`),
    "",
    `${action}: ${url}`,
    "",
    "You got this because you can open this design.",
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
              <td style="font-size:15px;line-height:1.6;color:#3f3f46;padding-bottom:12px;">${escapeHtml(lead)}</td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <div style="font-size:15px;line-height:1.6;color:#18181b;white-space:pre-wrap;word-break:break-word;border-left:3px solid #e4e4e7;padding:4px 0 4px 12px;">${escapeHtml(said)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${escapeHtml(url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:10px;">${action}</a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#71717a;">If the button doesn't work, paste this into your browser:<br><a href="${escapeHtml(url)}" style="color:#71717a;word-break:break-all;">${escapeHtml(url)}</a></td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#a1a1aa;padding-top:24px;">You got this because you can open this design.</td>
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
