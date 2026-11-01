"use client";

import { RiLogoutBoxRLine } from "@remixicon/react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSignOut } from "@/hooks/use-sign-out";

// Signs out and reloads `then` as a guest
export const SignOutButton = ({ then }: { then: string }) => {
  const { isPending, signOut } = useSignOut(then);

  return (
    <Button disabled={isPending} onClick={signOut}>
      {isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <RiLogoutBoxRLine data-icon="inline-start" />
      )}
      Sign out
    </Button>
  );
};
