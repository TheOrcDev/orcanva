import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { INVITE_PATH } from "@/lib/routes";

// An invite link's token: 32 random bytes, base64url. Only its hash is
// stored, so the database alone can't open anyone's invite.
const TOKEN_BYTES = 32;
const TOKEN = /^[\w-]{43}$/u;

export const hashInviteToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const createInviteToken = (): { token: string; tokenHash: string } => {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
};

export const isInviteToken = (value: string): boolean => TOKEN.test(value);

// Where an invite email's button goes
export const invitePath = (token: string): string => `${INVITE_PATH}/${token}`;

// The longest address email allows
const MAX_EMAIL_LENGTH = 254;

// An address to share with, as stored: trimmed and lowercased
export const shareEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_EMAIL_LENGTH)
  .pipe(z.email());

// How many people one design can be shared with
export const MAX_SHARES_PER_DESIGN = 50;

// How many invite emails one account can send an hour, across designs
export const MAX_INVITES_PER_HOUR = 30;
