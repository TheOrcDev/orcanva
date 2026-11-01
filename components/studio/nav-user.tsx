"use client";

import {
  RiExpandUpDownLine,
  RiLogoutBoxRLine,
  RiSettings3Line,
  RiUserLine,
} from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserAvatar } from "@/components/auth/user-menu";
import type { UserMenuViewer } from "@/components/auth/user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSignOut } from "@/hooks/use-sign-out";
import { signInUrl } from "@/lib/auth/redirect";
import { SETTINGS_PATH } from "@/lib/routes";

const ViewerLabel = ({ viewer }: { viewer: UserMenuViewer }) => (
  <span className="grid flex-1 text-left text-sm leading-tight">
    <span className="text-foreground truncate font-medium">{viewer.name}</span>
    <span className="text-muted-foreground truncate text-xs">
      {viewer.email}
    </span>
  </span>
);

// The sidebar's footer: "Sign in" for guests; the account, settings and
// sign-out for everyone else
export const NavUser = ({ viewer }: { viewer: UserMenuViewer | null }) => {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const { isPending, signOut } = useSignOut();

  if (!viewer) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Sign in"
            render={<Link href={signInUrl(pathname)} />}
          >
            <RiUserLine />
            <span>Sign in</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={`Account: ${viewer.name}`}
              />
            }
          >
            <UserAvatar viewer={viewer} size="sm" />
            <ViewerLabel viewer={viewer} />
            <RiExpandUpDownLine className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="flex items-center gap-2">
                  <UserAvatar viewer={viewer} size="sm" />
                  <ViewerLabel viewer={viewer} />
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
