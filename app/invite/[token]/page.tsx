import { RiLinkUnlink, RiTeamLine, RiUserLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { signInUrl, signUpUrl } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/server";
import { acceptInvite, findInvite, hasAccount } from "@/lib/db/queries/shares";
import type { Invite } from "@/lib/db/queries/shares";
import { STUDIO_PATH } from "@/lib/routes";
import {
  hashInviteToken,
  invitePath,
  isInviteToken,
} from "@/lib/sharing/invite";

// The link is a secret: keep it out of search results and Referer headers
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false },
  title: "Invite",
};

const InviteLayout = ({ children }: { children: ReactNode }) => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
    <Link href="/" className="flex items-center gap-2">
      <LogoMark className="size-5" />
      <span className="font-heading text-lg font-semibold">Orcanva</span>
    </Link>
    <div className="w-full max-w-md">{children}</div>
  </main>
);

const sharedBy = (invite: Invite) =>
  `${invite.ownerName ?? "Someone"} shared “${invite.designName}” with you`;

const NotValid = () => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiLinkUnlink />
      </EmptyMedia>
      <EmptyTitle>This invite doesn&apos;t work anymore</EmptyTitle>
      <EmptyDescription>
        It was sent again since, the design isn&apos;t shared with you any
        longer, or it was deleted. Ask its owner to share it with you again.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button variant="outline" render={<Link href={STUDIO_PATH} />}>
        Go to the studio
      </Button>
    </EmptyContent>
  </Empty>
);

// Signed out: an account with the invited email, new or existing, opens it
const SignInToOpen = ({
  invite,
  path,
  accountExists,
}: {
  invite: Invite;
  path: string;
  accountExists: boolean;
}) => {
  const signIn = signInUrl(path, invite.email);
  const signUp = signUpUrl(path, invite.email);
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RiTeamLine />
        </EmptyMedia>
        <EmptyTitle>{sharedBy(invite)}</EmptyTitle>
        <EmptyDescription>
          {accountExists
            ? `Sign in as ${invite.email} to open it.`
            : `Create your free Orcanva account with ${invite.email} to open it and edit it together.`}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        {accountExists ? (
          <Button render={<Link href={signIn} />}>
            <RiUserLine data-icon="inline-start" />
            Sign in
          </Button>
        ) : (
          <>
            <Button render={<Link href={signUp} />}>
              <RiUserLine data-icon="inline-start" />
              Create your account
            </Button>
            <Button variant="outline" render={<Link href={signIn} />}>
              I have an account
            </Button>
          </>
        )}
      </EmptyContent>
    </Empty>
  );
};

const WrongAccount = ({
  invite,
  path,
  viewerEmail,
}: {
  invite: Invite;
  path: string;
  viewerEmail: string;
}) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiUserLine />
      </EmptyMedia>
      <EmptyTitle>{sharedBy(invite)}</EmptyTitle>
      <EmptyDescription>
        The invite is for {invite.email}, and you&apos;re signed in as{" "}
        {viewerEmail}. Sign out, then sign in or create an account with{" "}
        {invite.email}.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <SignOutButton then={path} />
    </EmptyContent>
  </Empty>
);

// Where a share email's button goes. The token shows the inbox is theirs, so
// the signed-in account with the invited address gets the design, even if
// its email was never verified. A page rather than a Route Handler so it
// can explain itself; accepting is idempotent, so a reload is harmless.
const InvitePage = async (props: PageProps<"/invite/[token]">) => {
  await connection();
  const { token } = await props.params;
  const tokenHash = isInviteToken(token) ? hashInviteToken(token) : null;
  const invite = tokenHash ? await findInvite(tokenHash) : null;
  if (!(tokenHash && invite)) {
    return (
      <InviteLayout>
        <NotValid />
      </InviteLayout>
    );
  }

  const path = invitePath(token);
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <InviteLayout>
        <SignInToOpen
          invite={invite}
          path={path}
          accountExists={await hasAccount(invite.email)}
        />
      </InviteLayout>
    );
  }
  if (viewer.email.toLowerCase() !== invite.email) {
    return (
      <InviteLayout>
        <WrongAccount invite={invite} path={path} viewerEmail={viewer.email} />
      </InviteLayout>
    );
  }
  if (!(await acceptInvite(tokenHash, viewer.id))) {
    return (
      <InviteLayout>
        <NotValid />
      </InviteLayout>
    );
  }
  redirect(`/design/${invite.designId}`);
};

export default InvitePage;
