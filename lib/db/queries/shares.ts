import "server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { authUsers } from "@/lib/db/auth-schema";
import { getDb } from "@/lib/db/client";
import { designShares, designs } from "@/lib/db/schema";

// Someone a design is shared with, as its owner sees them
export interface SharePerson {
  email: string;
  // The account behind the email, once one can open the design
  name: string | null;
  image: string | null;
  // False while the invite waits to be accepted
  hasAccess: boolean;
}

// Who the design is shared with, in the order they were added. An account
// can open it once it accepted the invite, or when its verified email
// matches (the same rule as sharedWith in ./designs).
export const listDesignShares = async (
  designId: string
): Promise<SharePerson[]> => {
  const accepted = alias(authUsers, "accepted_user");
  const verified = alias(authUsers, "verified_user");
  const rows = await getDb()
    .select({
      acceptedImage: accepted.image,
      acceptedName: accepted.name,
      email: designShares.email,
      verifiedImage: verified.image,
      verifiedName: verified.name,
    })
    .from(designShares)
    .leftJoin(accepted, eq(accepted.id, designShares.userId))
    .leftJoin(
      verified,
      and(
        eq(sql`lower(${verified.email})`, designShares.email),
        eq(verified.emailVerified, true)
      )
    )
    .where(eq(designShares.designId, designId))
    .orderBy(designShares.createdAt, designShares.email);

  return rows.map((row) => {
    const name = row.acceptedName ?? row.verifiedName;
    return {
      email: row.email,
      hasAccess: name !== null,
      image: row.acceptedName ? row.acceptedImage : row.verifiedImage,
      name,
    };
  });
};

export interface Invite {
  designId: string;
  designName: string;
  email: string;
  ownerName: string | null;
}

// The invite a link's token belongs to; null once it's been replaced by a
// newer one, the person was removed, or the design deleted
export const findInvite = async (tokenHash: string): Promise<Invite | null> => {
  const [row] = await getDb()
    .select({
      designId: designShares.designId,
      designName: designs.name,
      email: designShares.email,
      ownerName: authUsers.name,
    })
    .from(designShares)
    .innerJoin(designs, eq(designs.id, designShares.designId))
    .leftJoin(authUsers, eq(authUsers.id, designs.ownerId))
    .where(eq(designShares.tokenHash, tokenHash))
    .limit(1);
  return row ?? null;
};

// Ties the invite to the account that opened it. False when another
// account accepted it first.
export const acceptInvite = async (
  tokenHash: string,
  userId: string
): Promise<boolean> => {
  const rows = await getDb()
    .update(designShares)
    .set({ userId })
    .where(
      and(
        eq(designShares.tokenHash, tokenHash),
        or(isNull(designShares.userId), eq(designShares.userId, userId))
      )
    )
    .returning({ designId: designShares.designId });
  return rows.length > 0;
};

// Whether anyone has an account with this (lowercased) email
export const hasAccount = async (email: string): Promise<boolean> => {
  const [row] = await getDb()
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(sql`lower(${authUsers.email})`, email))
    .limit(1);
  return row !== undefined;
};
