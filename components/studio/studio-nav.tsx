"use client";

import { RiGlobalLine, RiLockLine, RiTeamLine } from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  PRIVATE_DESIGNS_PATH,
  PUBLIC_DESIGNS_PATH,
  SHARED_DESIGNS_PATH,
} from "@/lib/routes";

const PAGES = [
  { href: PRIVATE_DESIGNS_PATH, icon: RiLockLine, label: "Private" },
  { href: PUBLIC_DESIGNS_PATH, icon: RiGlobalLine, label: "Public" },
  { href: SHARED_DESIGNS_PATH, icon: RiTeamLine, label: "Shared with you" },
] as const;

// The galleries: each design is on Private or Public, by its visibility.
// Shared with you lists others' designs shared with the viewer, either way.
export const StudioNav = () => {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Designs</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {PAGES.map((page) => {
            const isActive = pathname === page.href;
            return (
              <SidebarMenuItem key={page.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={page.label}
                  render={
                    <Link
                      href={page.href}
                      aria-current={isActive ? "page" : undefined}
                      // On phones the sidebar covers the page it opens
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                >
                  <page.icon />
                  <span>{page.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
