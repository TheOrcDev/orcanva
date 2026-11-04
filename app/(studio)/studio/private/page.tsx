import {
  RiGlobalLine,
  RiLayoutMasonryLine,
  RiLockLine,
  RiUserLine,
} from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DesignGrid, toDesignCards } from "@/components/gallery/design-grid";
import type { DesignCardData } from "@/components/gallery/design-grid";
import { NewDesignDialog } from "@/components/gallery/new-design-dialog";
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
import { listPrivateDesigns } from "@/lib/db/queries/designs";
import { PRIVATE_DESIGNS_PATH, PUBLIC_DESIGNS_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: "Private designs" };

// Guests can't own designs, so the page explains what an account adds
const SignInToKeepPrivate = () => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiLockLine />
      </EmptyMedia>
      <EmptyTitle>Private designs need an account</EmptyTitle>
      <EmptyDescription>
        Sign in to keep designs only you can see. Public designs are open to
        everyone, signed in or not.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent className="flex-row flex-wrap justify-center">
      <Button render={<Link href={signInUrl(PRIVATE_DESIGNS_PATH)} />}>
        <RiUserLine data-icon="inline-start" />
        Sign in
      </Button>
      <Button variant="outline" render={<Link href={PUBLIC_DESIGNS_PATH} />}>
        <RiGlobalLine data-icon="inline-start" />
        Browse public designs
      </Button>
    </EmptyContent>
  </Empty>
);

const PrivateDesigns = ({ cards }: { cards: DesignCardData[] }) =>
  cards.length === 0 ? (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RiLayoutMasonryLine />
        </EmptyMedia>
        <EmptyTitle>No private designs</EmptyTitle>
        <EmptyDescription>
          Create one, start from a template, or make a copy of a public design.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <NewDesignDialog signedIn />
      </EmptyContent>
    </Empty>
  ) : (
    <DesignGrid cards={cards} signedIn />
  );

const PrivateDesignsPage = async () => {
  // Always read fresh from Neon; this page must never be prerendered
  await connection();
  const viewer = await getViewer();
  const designs = viewer ? await listPrivateDesigns(viewer.id) : [];

  return (
    <>
      <PageHeader title="Private designs" />
      <PageBody>
        <p className="text-muted-foreground text-sm">
          Only you and the people you share them with can see these. Make one
          public to edit it with anyone, live.
        </p>
        {viewer ? (
          <PrivateDesigns cards={toDesignCards(designs, viewer.id)} />
        ) : (
          <SignInToKeepPrivate />
        )}
      </PageBody>
    </>
  );
};

export default PrivateDesignsPage;
