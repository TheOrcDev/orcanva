import { RiGlobalLine, RiLockLine, RiUserLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DesignGrid, toDesignCards } from "@/components/gallery/design-grid";
import type { DesignCardData } from "@/components/gallery/design-grid";
import { PageBody, PageHeader } from "@/components/studio/page-header";
import { PublicFilter } from "@/components/studio/public-filter";
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
import { listPublicDesigns } from "@/lib/db/queries/designs";
import {
  OWNER_MINE,
  PRIVATE_DESIGNS_PATH,
  PUBLIC_DESIGNS_PATH,
} from "@/lib/routes";

export const metadata: Metadata = { title: "Public designs" };

const NoPublicDesigns = ({ signedIn }: { signedIn: boolean }) => (
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
        <Button render={<Link href={signInUrl(PUBLIC_DESIGNS_PATH)} />}>
          <RiUserLine data-icon="inline-start" />
          Sign in to create
        </Button>
      </EmptyContent>
    )}
  </Empty>
);

// Filtered to the viewer's own: point them at their private designs
const NoPublicDesignsOfYours = () => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiGlobalLine />
      </EmptyMedia>
      <EmptyTitle>None of yours are public</EmptyTitle>
      <EmptyDescription>
        Make one of your private designs public from its menu, and anyone can
        open it and edit it with you.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button variant="outline" render={<Link href={PRIVATE_DESIGNS_PATH} />}>
        <RiLockLine data-icon="inline-start" />
        Your private designs
      </Button>
    </EmptyContent>
  </Empty>
);

const PublicDesigns = ({
  cards,
  onlyMine,
  signedIn,
}: {
  cards: DesignCardData[];
  onlyMine: boolean;
  signedIn: boolean;
}) => {
  if (cards.length > 0) {
    return <DesignGrid cards={cards} signedIn={signedIn} />;
  }
  return onlyMine ? (
    <NoPublicDesignsOfYours />
  ) : (
    <NoPublicDesigns signedIn={signedIn} />
  );
};

const PublicDesignsPage = async ({
  searchParams,
}: PageProps<"/studio/public">) => {
  // Always read fresh from Neon; this page must never be prerendered
  await connection();
  const [viewer, { owner }] = await Promise.all([getViewer(), searchParams]);
  const signedIn = viewer !== null;
  // Guests own nothing, so they always see everyone's
  const onlyMine = viewer !== null && owner === OWNER_MINE;
  const designs = await listPublicDesigns(
    onlyMine ? { ownerId: viewer.id } : {}
  );
  const cards = toDesignCards(designs, viewer?.id ?? null);

  return (
    <>
      <PageHeader
        title="Public designs"
        actions={signedIn ? <PublicFilter onlyMine={onlyMine} /> : null}
      />
      <PageBody>
        <p className="text-muted-foreground text-sm">
          {signedIn
            ? "Anyone can open these and edit them together, live."
            : "Open one to edit it together with others, live. Sign in to keep private designs of your own."}
        </p>
        <PublicDesigns cards={cards} onlyMine={onlyMine} signedIn={signedIn} />
      </PageBody>
    </>
  );
};

export default PublicDesignsPage;
