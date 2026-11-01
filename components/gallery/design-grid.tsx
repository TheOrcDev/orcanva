import { DesignCard } from "@/components/gallery/design-card";
import type { DesignCardProps } from "@/components/gallery/design-card";
import type { DesignSummary } from "@/lib/db/queries/designs";
import { formatRelativeTime, formatSize } from "@/lib/format";
import { storageUrl } from "@/lib/storage/keys";

export type DesignCardData = Omit<DesignCardProps, "signedIn">;

export const GRID_CLASS_NAME =
  "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

// What each design's card shows to `viewerId`
export const toDesignCards = (
  designs: DesignSummary[],
  viewerId: string | null,
  now = new Date()
): DesignCardData[] =>
  designs.map((design) => ({
    canManage: viewerId !== null && design.ownerId === viewerId,
    editedLabel: formatRelativeTime(design.updatedAt, now),
    id: design.id,
    name: design.name,
    ownerName: design.ownerName,
    sizeLabel: formatSize(design.width, design.height),
    thumbnailUrl: design.thumbnailKey ? storageUrl(design.thumbnailKey) : null,
    visibility: design.visibility,
  }));

export const DesignGrid = ({
  cards,
  signedIn,
}: {
  cards: DesignCardData[];
  signedIn: boolean;
}) => (
  <ul className={GRID_CLASS_NAME}>
    {cards.map((card) => (
      <li key={card.id}>
        <DesignCard {...card} signedIn={signedIn} />
      </li>
    ))}
  </ul>
);
