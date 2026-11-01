"use client";

import {
  RiLogoutBoxRLine,
  RiSettings3Line,
  RiUserLine,
} from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
import { useSignOut } from "@/hooks/use-sign-out";
import { signInUrl } from "@/lib/auth/redirect";
import { initials } from "@/lib/collab/identity";
import { SETTINGS_PATH } from "@/lib/routes";

export interface UserMenuViewer {
  name: string;
  email: string;
  image: string | null;
}

export const UserAvatar = ({
  viewer,
  size,
  className,
}: {
  viewer: Pick<UserMenuViewer, "name" | "image">;
  size?: "sm" | "default" | "lg";
  className?: string;
}) => (
  <Avatar size={size} className={className}>
    {viewer.image ? <AvatarImage src={viewer.image} alt="" /> : null}
    <AvatarFallback>{initials(viewer.name)}</AvatarFallback>
  </Avatar>
);

// "Sign in" for guests; the account, settings and sign-out for everyone else
export const UserMenu = ({ viewer }: { viewer: UserMenuViewer | null }) => {
  const pathname = usePathname();
  const { isPending, signOut } = useSignOut();

  if (!viewer) {
    return (
      <Button variant="outline" render={<Link href={signInUrl(pathname)} />}>
        <RiUserLine data-icon="inline-start" />
        Sign in
      </Button>
    );
  }

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
          <DropdownMenuItem render={<Link href={SETTINGS_PATH} />}>
            <RiSettings3Line />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isPending} onClick={signOut}>
            <RiLogoutBoxRLine />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
