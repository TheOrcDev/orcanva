import { RiLayoutMasonryLine, RiPaletteLine } from "@remixicon/react";
import { connection } from "next/server";

import { UserMenu } from "@/components/auth/user-menu";
import { DesignCard } from "@/components/gallery/design-card";
import { NewDesignDialog } from "@/components/gallery/new-design-dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getViewer } from "@/lib/auth/server";
import { listDesigns } from "@/lib/db/queries/designs";
import { formatRelativeTime, formatSize } from "@/lib/format";
import { storageUrl } from "@/lib/storage/keys";

const loadGallery = async () => {
  // Always read fresh from Neon; this page must never be prerendered
  await connection();
  const [designs, viewer] = await Promise.all([listDesigns(), getViewer()]);
  const now = new Date();
  const cards = designs.map((design) => ({
    editedLabel: formatRelativeTime(design.updatedAt, now),
    id: design.id,
    name: design.name,
    sizeLabel: formatSize(design.width, design.height),
    thumbnailUrl: design.thumbnailKey ? storageUrl(design.thumbnailKey) : null,
  }));
  return { designs: cards, viewer };
};

const GalleryPage = async () => {
  const { designs, viewer } = await loadGallery();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2">
            <RiPaletteLine aria-hidden />
            <span className="font-heading text-lg font-semibold">Orcanva</span>
          </div>
          <div className="flex items-center gap-2">
            <NewDesignDialog />
            <UserMenu viewer={viewer} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">Your designs</h1>
          <p className="text-muted-foreground text-sm">
            Open a design to keep editing, or duplicate one to use it as a
            template.
          </p>
        </div>

        {designs.length === 0 ? (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RiLayoutMasonryLine />
              </EmptyMedia>
              <EmptyTitle>No designs yet</EmptyTitle>
              <EmptyDescription>
                Create your first thumbnail. Pick a size and start adding images
                and text.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <NewDesignDialog />
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {designs.map((design) => (
              <li key={design.id}>
                <DesignCard {...design} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default GalleryPage;
