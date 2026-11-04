import { RiGlobalLine, RiTeamLine, RiUserLine } from "@remixicon/react";
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
import { isAdmin } from "@/lib/auth/admin";
import { signInUrl } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/server";
import { listSharedDesigns } from "@/lib/db/queries/designs";
import { PUBLIC_DESIGNS_PATH, SHARED_DESIGNS_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: "Shared with you" };

// Designs are shared with accounts, by email
const SignInToSeeShared = () => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiTeamLine />
      </EmptyMedia>
      <EmptyTitle>Sign in to see what&apos;s shared with you</EmptyTitle>
      <EmptyDescription>
        People share designs with your email. Sign in with it to open them.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent className="flex-row flex-wrap justify-center">
      <Button render={<Link href={signInUrl(SHARED_DESIGNS_PATH)} />}>
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

const NothingShared = () => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiTeamLine />
      </EmptyMedia>
      <EmptyTitle>Nothing shared with you yet</EmptyTitle>
      <EmptyDescription>
        When someone shares a design with your email, it shows up here.
      </EmptyDescription>
    </EmptyHeader>
  </Empty>
);

const SharedDesignsPage = async () => {
  // Always read fresh from Neon; this page must never be prerendered
  await connection();
  const viewer = await getViewer();
  const [designs, admin] = viewer
    ? await Promise.all([listSharedDesigns(viewer.id), isAdmin(viewer.id)])
    : [[], false];
  const cards = toDesignCards(designs, viewer?.id ?? null, { isAdmin: admin });

  return (
    <>
      <PageHeader title="Shared with you" />
      <PageBody>
        <p className="text-muted-foreground text-sm">
          Other people&apos;s designs you can edit with them, public or private.
        </p>
        {viewer ? null : <SignInToSeeShared />}
        {viewer && cards.length === 0 ? <NothingShared /> : null}
        {cards.length > 0 ? <DesignGrid cards={cards} signedIn /> : null}
      </PageBody>
    </>
  );
};

export default SharedDesignsPage;
