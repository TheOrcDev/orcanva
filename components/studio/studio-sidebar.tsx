import { RiAddLine } from "@remixicon/react";
import Link from "next/link";

import type { UserMenuViewer } from "@/components/auth/user-menu";
import { NewDesignDialog } from "@/components/gallery/new-design-dialog";
import { LogoMark } from "@/components/logo-mark";
import { NavUser } from "@/components/studio/nav-user";
import { StudioNav } from "@/components/studio/studio-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export const StudioSidebar = ({
  viewer,
}: {
  viewer: UserMenuViewer | null;
}) => (
  <Sidebar>
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Orcanva" render={<Link href="/" />}>
            <LogoMark className="size-5" />
            <span className="font-heading text-base font-semibold">
              Orcanva
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {/* Creating a design needs an account: guests sign in from the footer */}
        {viewer ? (
          <SidebarMenuItem>
            <NewDesignDialog
              render={
                <SidebarMenuButton variant="primary" tooltip="New design" />
              }
            >
              <RiAddLine />
              <span>New design</span>
            </NewDesignDialog>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <StudioNav />
    </SidebarContent>
    <SidebarFooter>
      <NavUser viewer={viewer} />
    </SidebarFooter>
  </Sidebar>
);
