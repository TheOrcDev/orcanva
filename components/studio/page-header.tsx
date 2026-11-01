import type { ComponentProps, ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// The bar along the top of every studio page: the sidebar toggle (the only
// way to open it on phones), the page's title, and its own controls
export const PageHeader = ({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) => (
  <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
    <SidebarTrigger />
    <Separator
      orientation="vertical"
      className="mr-2 data-vertical:h-4 data-vertical:self-auto"
    />
    <h1 className="font-heading truncate text-lg font-semibold">{title}</h1>
    {actions ? (
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    ) : null}
  </header>
);

export const PageBody = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn(
      "mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6",
      className
    )}
    {...props}
  />
);
