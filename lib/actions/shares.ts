"use server";

import { and, count, eq, gt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { getViewer } from "@/lib/auth/server";
import type { Viewer } from "@/lib/auth/server";
import { authUsers } from "@/lib/db/auth-schema";
import { getDb } from "@/lib/db/client";
import { listDesignShares } from "@/lib/db/queries/shares";
import type { SharePerson } from "@/lib/db/queries/shares";
import { designShares, designs } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { shareInviteEmail } from "@/lib/email/share-invite";
import {
  MAX_INVITES_PER_HOUR,
  MAX_SHARES_PER_DESIGN,
  createInviteToken,
  invitePath,
  shareEmail,
} from "@/lib/sharing/invite";
import { SITE_URL } from "@/lib/site";

// Sharing is the owner's alone: each action checks the session and that
// the design is theirs. Server Actions are public endpoints.

const requireViewer = async (): Promise<Viewer> => {
  const viewer = await getViewer();
  if (!viewer) {
    throw new Error("Sign in first");
  }
  return viewer;
};

// The design's name, when the viewer owns it
const ownedDesignName = async (
  id: string,
  viewer: Viewer
): Promise<string | null> => {
  const [row] = await getDb()
    .select({ name: designs.name })
    .from(designs)
    .where(and(eq(designs.id, id), eq(designs.ownerId, viewer.id)))
    .limit(1);
  return row?.name ?? null;
};

// Where invite links point. Production always links to its own address,
// whatever host a request claims; dev links back to the local server.
const appOrigin = async (): Promise<string> => {
  if (process.env.NODE_ENV === "production") {
    return SITE_URL;
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  return `http://${host}`;
};

const designId = z.uuid();

export const listShares = async (id: string): Promise<SharePerson[]> => {
  const parsed = designId.parse(id);
  const viewer = await requireViewer();
  if ((await ownedDesignName(parsed, viewer)) === null) {
    throw new Error("Design not found");
  }
  return listDesignShares(parsed);
};

export type ShareResult =
  | { ok: true; emailed: boolean; people: SharePerson[] }
  | { ok: false; error: string };

const shareInput = z.object({ email: z.string(), id: z.uuid() });

// Shares the design with an email address and emails them the invite.
// Sharing with someone again sends a fresh invite, and only its link works.
// Refusals come back as messages for the owner rather than errors, which
// production would hide.
export const shareDesign = async (
  input: z.input<typeof shareInput>
): Promise<ShareResult> => {
  const { email: rawEmail, id } = shareInput.parse(input);
  const parsedEmail = shareEmail.safeParse(rawEmail);
  if (!parsedEmail.success) {
    return { error: "Enter an email address", ok: false };
  }
  const email = parsedEmail.data;
  const viewer = await requireViewer();
  if (email === viewer.email.toLowerCase()) {
    return { error: "That's you: it's your design already", ok: false };
  }

  const db = getDb();
  const [owned, people, sentLastHour, account] = await db.batch([
    db
      .select({ name: designs.name })
      .from(designs)
      .where(and(eq(designs.id, id), eq(designs.ownerId, viewer.id)))
      .limit(1),
    db
      .select({ email: designShares.email })
      .from(designShares)
      .where(eq(designShares.designId, id)),
    db
      .select({ sent: count() })
      .from(designShares)
      .innerJoin(designs, eq(designs.id, designShares.designId))
      .where(
        and(
          eq(designs.ownerId, viewer.id),
          gt(designShares.invitedAt, sql`now() - interval '1 hour'`)
        )
      ),
    db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(sql`lower(${authUsers.email})`, email))
      .limit(1),
  ]);
  const [design] = owned;
  if (!design) {
    throw new Error("Design not found");
  }
  const isNew = !people.some((person) => person.email === email);
  if (isNew && people.length >= MAX_SHARES_PER_DESIGN) {
    return {
      error: `A design can be shared with up to ${MAX_SHARES_PER_DESIGN} people`,
      ok: false,
    };
  }
  if ((sentLastHour[0]?.sent ?? 0) >= MAX_INVITES_PER_HOUR) {
    return {
      error: "You've sent a lot of invites. Try again in an hour.",
      ok: false,
    };
  }

  const { token, tokenHash } = createInviteToken();
  await db
    .insert(designShares)
    .values({ designId: id, email, tokenHash })
    .onConflictDoUpdate({
      set: { invitedAt: sql`now()`, tokenHash },
      target: [designShares.designId, designShares.email],
    });

  const url = new URL(invitePath(token), await appOrigin()).href;
  const emailed = await sendEmail({
    ...shareInviteEmail({
      designName: design.name,
      email,
      hasAccount: account.length > 0,
      ownerName: viewer.name,
      url,
    }),
    replyTo: viewer.email,
    to: email,
  });
  return { emailed, ok: true, people: await listDesignShares(id) };
};

const unshareInput = z.object({ email: z.string(), id: z.uuid() });

// Stops sharing with that address. Anyone it locks out finds out on their
// next save or live renewal, within about a minute.
export const unshareDesign = async (
  input: z.input<typeof unshareInput>
): Promise<SharePerson[]> => {
  const { email, id } = unshareInput.parse(input);
  const viewer = await requireViewer();
  const [design] = await getDb()
    .delete(designShares)
    .where(
      and(
        eq(designShares.designId, id),
        eq(designShares.email, email.trim().toLowerCase()),
        sql`${designShares.designId} IN (SELECT ${designs.id} FROM ${designs} WHERE ${designs.ownerId} = ${viewer.id})`
      )
    )
    .returning({ id: designShares.designId });
  if (!design && (await ownedDesignName(id, viewer)) === null) {
    throw new Error("Design not found");
  }
  return listDesignShares(id);
};
