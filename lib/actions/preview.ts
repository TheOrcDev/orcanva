"use server";

import { z } from "zod";

import { getViewer } from "@/lib/auth/server";
import {
  listPrivateDesigns,
  listPublicDesigns,
} from "@/lib/db/queries/designs";
import { storageUrl } from "@/lib/storage/keys";

// Server Actions are public endpoints: this one checks the session itself

export interface CompareDesign {
  id: string;
  name: string;
  // The gallery preview, which can lag the latest edit by a few seconds
  thumbnailUrl: string;
  width: number;
  height: number;
}

const MAX_COMPARE_DESIGNS = 30;

// The signed-in person's own designs, private and public, that have a
// gallery preview, newest first, for the YouTube preview to compare a
// design with. Guests have none.
export const listCompareDesigns = async (
  excludeId: string
): Promise<CompareDesign[]> => {
  const exclude = z.uuid().parse(excludeId);
  const viewer = await getViewer();
  if (!viewer) {
    return [];
  }
  const [own, ownPublic] = await Promise.all([
    listPrivateDesigns(viewer.id),
    listPublicDesigns({ ownerId: viewer.id }),
  ]);
  return [...own, ...ownPublic]
    .toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .flatMap((design) =>
      design.id !== exclude && design.thumbnailKey
        ? [
            {
              height: design.height,
              id: design.id,
              name: design.name,
              thumbnailUrl: storageUrl(design.thumbnailKey),
              width: design.width,
            },
          ]
        : []
    )
    .slice(0, MAX_COMPARE_DESIGNS);
};
