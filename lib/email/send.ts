import "server-only";
import { Resend } from "resend";

import { getEnv } from "@/lib/env";

// The domain verified in Resend until orcanva.app is
const DEFAULT_FROM = "Orcanva <orcanva@orcdev.com>";

let client: Resend | undefined;

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Where replies go, e.g. the person who shared a design
  replyTo?: string;
}

// Sends one email through Resend. False when it didn't go out: no API key
// (local dev can do without), or Resend refused it.
export const sendEmail = async (email: OutgoingEmail): Promise<boolean> => {
  const { EMAIL_FROM, RESEND_API_KEY } = getEnv();
  if (!RESEND_API_KEY) {
    return false;
  }
  client ??= new Resend(RESEND_API_KEY);
  try {
    const { error } = await client.emails.send({
      from: EMAIL_FROM ?? DEFAULT_FROM,
      ...email,
    });
    return error === null;
  } catch {
    return false;
  }
};
