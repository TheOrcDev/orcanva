import { RiGlobalLine, RiUserLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DesignGrid, toDesignCards } from "@/components/gallery/design-grid";
import { PageBody, PageHeader } from "@/components/studio/page-header";
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
import { PUBLIC_DESIGNS_PATH } from "@/lib/routes";

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

const PublicDesignsPage = async () => {
  // Always read fresh from Neon; this page must never be prerendered
  await connection();
  const [viewer, designs] = await Promise.all([
    getViewer(),
    listPublicDesigns(),
  ]);
  const signedIn = viewer !== null;
  const cards = toDesignCards(designs, viewer?.id ?? null);

  return (
    <>
      <PageHeader title="Public designs" />
      <PageBody>
        <p className="text-muted-foreground text-sm">
          {signedIn
            ? "Anyone can open these and edit them together, live."
            : "Open one to edit it together with others, live. Sign in to keep private designs of your own."}
        </p>
        {cards.length === 0 ? (
          <NoPublicDesigns signedIn={signedIn} />
        ) : (
          <DesignGrid cards={cards} signedIn={signedIn} />
        )}
      </PageBody>
    </>
  );
};

export default PublicDesignsPage;
