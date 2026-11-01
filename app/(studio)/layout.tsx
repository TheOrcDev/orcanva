import type { Metadata } from "next";
import type { ReactNode } from "react";

import { StudioSidebar } from "@/components/studio/studio-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getViewer } from "@/lib/auth/server";

// The studio is the app, not a page to land on from search: its galleries
// change by the minute and differ per person. Links in it are still followed.
export const metadata: Metadata = { robots: { follow: true, index: false } };

// One sidebar around the studio's pages. It reads only the (cached) session,
// so each page's loading skeleton still shows at once.
const StudioLayout = async ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => {
  const viewer = await getViewer();

  return (
    <SidebarProvider>
      <StudioSidebar
        viewer={
          viewer
            ? { email: viewer.email, image: viewer.image, name: viewer.name }
            : null
        }
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
};

export default StudioLayout;
