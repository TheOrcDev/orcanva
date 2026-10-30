"use client";

import { RiLogoutBoxRLine, RiUserLine } from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth/client";
import { signInUrl } from "@/lib/auth/redirect";
import { initials } from "@/lib/collab/identity";

export interface UserMenuViewer {
  name: string;
  email: string;
  image: string | null;
}

export const UserAvatar = ({
  viewer,
  size,
}: {
  viewer: Pick<UserMenuViewer, "name" | "image">;
  size?: "sm" | "default" | "lg";
}) => (
  <Avatar size={size}>
    {viewer.image ? <AvatarImage src={viewer.image} alt="" /> : null}
    <AvatarFallback>{initials(viewer.name)}</AvatarFallback>
  </Avatar>
);

// "Sign in" for guests; the account and sign-out for everyone else
export const UserMenu = ({ viewer }: { viewer: UserMenuViewer | null }) => {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  if (!viewer) {
    return (
      <Button variant="outline" render={<Link href={signInUrl(pathname)} />}>
        <RiUserLine data-icon="inline-start" />
        Sign in
      </Button>
    );
  }

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        await authClient.signOut();
        // A full load, so nothing of this account stays on screen
        window.location.assign("/");
      } catch {
        toast.add({ title: "Couldn't sign you out", type: "error" });
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Account: ${viewer.name}`}
          />
        }
      >
        <UserAvatar viewer={viewer} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate">{viewer.name}</span>
            <span className="text-muted-foreground block truncate font-normal">
              {viewer.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={isPending} onClick={handleSignOut}>
            <RiLogoutBoxRLine />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
