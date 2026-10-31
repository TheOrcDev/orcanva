import {
  RiGlobalLine,
  RiLayoutMasonryLine,
  RiPaletteLine,
  RiUserLine,
} from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { UserMenu } from "@/components/auth/user-menu";
import { DesignCard } from "@/components/gallery/design-card";
import type { DesignCardProps } from "@/components/gallery/design-card";
import { NewDesignDialog } from "@/components/gallery/new-design-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { signInUrl } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/server";
import { listOwnDesigns, listPublicDesigns } from "@/lib/db/queries/designs";
import type { DesignSummary } from "@/lib/db/queries/designs";
import { formatRelativeTime, formatSize } from "@/lib/format";
import { STUDIO_PATH } from "@/lib/routes";
import { storageUrl } from "@/lib/storage/keys";

export const metadata: Metadata = { title: "Studio" };

type Card = Omit<DesignCardProps, "signedIn">;

const loadGallery = async () => {
  // Always read fresh from Neon; this page must never be prerendered
  await connection();
  const viewer = await getViewer();
  const [own, shared] = await Promise.all([
    viewer ? listOwnDesigns(viewer.id) : [],
    listPublicDesigns(viewer?.id ?? null),
  ]);
  const now = new Date();
  const toCard = (design: DesignSummary): Card => ({
    canManage: viewer !== null && design.ownerId === viewer.id,
    editedLabel: formatRelativeTime(design.updatedAt, now),
    id: design.id,
    name: design.name,
    ownerName: design.ownerName,
    sizeLabel: formatSize(design.width, design.height),
    thumbnailUrl: design.thumbnailKey ? storageUrl(design.thumbnailKey) : null,
    visibility: design.visibility,
  });
  return {
    own: own.map(toCard),
    shared: shared.map(toCard),
    viewer,
  };
};

// Creating a design needs an account, so guests are sent to sign in
const CreateButton = ({ signedIn }: { signedIn: boolean }) =>
  signedIn ? (
    <NewDesignDialog />
  ) : (
    <Button render={<Link href={signInUrl(STUDIO_PATH)} />}>
      <RiUserLine data-icon="inline-start" />
      Sign in to create
    </Button>
  );

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-6">
    <div className="flex flex-col gap-1">
      <h2 className="font-heading text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
    {children}
  </section>
);

const CardGrid = ({
  cards,
  signedIn,
}: {
  cards: Card[];
  signedIn: boolean;
}) => (
  <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {cards.map((card) => (
      <li key={card.id}>
        <DesignCard {...card} signedIn={signedIn} />
      </li>
    ))}
  </ul>
);

const StudioPage = async () => {
  const { own, shared, viewer } = await loadGallery();
  const signedIn = viewer !== null;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2">
            <RiPaletteLine aria-hidden />
            <h1 className="font-heading text-lg font-semibold">Orcanva</h1>
          </Link>
          <div className="flex items-center gap-2">
            <CreateButton signedIn={signedIn} />
            <UserMenu viewer={viewer} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-6 py-8">
        {signedIn ? (
          <Section
            title="Your designs"
            description="Private ones are only yours. Make one public to let anyone edit it with you."
          >
            {own.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <RiLayoutMasonryLine />
                  </EmptyMedia>
                  <EmptyTitle>No designs yet</EmptyTitle>
                  <EmptyDescription>
                    Create your first thumbnail, or use a public design as a
                    template.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <CreateButton signedIn />
                </EmptyContent>
              </Empty>
            ) : (
              <CardGrid cards={own} signedIn />
            )}
          </Section>
        ) : null}

        <Section
          title="Public designs"
          description={
            signedIn
              ? "Anyone can open these and edit them together, live."
              : "Open one to edit it together with others, live. Sign in to keep private designs of your own."
          }
        >
          {shared.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <RiGlobalLine />
                </EmptyMedia>
                <EmptyTitle>No public designs yet</EmptyTitle>
                <EmptyDescription>
                  Make one of yours public and it shows up here for everyone.
                </EmptyDescription>
              </EmptyHeader>
              {signedIn ? null : (
                <EmptyContent>
                  <CreateButton signedIn={false} />
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <CardGrid cards={shared} signedIn={signedIn} />
          )}
        </Section>
      </main>
    </div>
  );
};

export default StudioPage;
