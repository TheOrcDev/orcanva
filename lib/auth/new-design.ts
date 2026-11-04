import "server-only";
import { and, count, gt, isNull } from "drizzle-orm";

import type { Visibility } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { designs } from "@/lib/db/schema";

// New designs by guests in the last hour, all guests together: they can't
// be told apart, so they share the cap. It keeps a script from flooding the
// public gallery; signing in lifts it.
export const GUEST_DESIGNS_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

// Who a new design belongs to: the viewer, or nobody when a guest makes it.
// Guests can only make public designs, which anyone can edit and only an
// admin can delete (canDeleteDesign).
export const ownerOfNewDesign = async (
  visibility: Visibility
): Promise<string | null> => {
  const viewer = await getViewer();
  if (viewer) {
    return viewer.id;
  }
  if (visibility !== "public") {
    throw new Error("Sign in to keep a design private");
  }
  const [recent] = await getDb()
    .select({ total: count() })
    .from(designs)
    .where(
      and(
        isNull(designs.ownerId),
        gt(designs.createdAt, new Date(Date.now() - HOUR_MS))
      )
    );
  if ((recent?.total ?? 0) >= GUEST_DESIGNS_PER_HOUR) {
    throw new Error("Too many new designs by guests: sign in, or try later");
  }
  return null;
};
