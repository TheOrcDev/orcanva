import { RiCursorFill } from "@remixicon/react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// A collaborator's pointer with their name, the way the editor draws it.
// The arrow's tip sits at the top-left corner of the box.
const Cursor = ({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className: string;
  tone: "primary" | "secondary";
}) => (
  <div className={cn("absolute flex items-start", className)}>
    <RiCursorFill
      className={cn(
        "-mt-1 -ml-1 size-5",
        tone === "primary" ? "text-primary" : "text-secondary-foreground"
      )}
    />
    <Badge
      variant={tone === "primary" ? "default" : "secondary"}
      className="mt-3"
    >
      {children}
    </Badge>
  </div>
);

const Handle = ({ className }: { className: string }) => (
  <span
    className={cn(
      "border-foreground bg-card absolute size-2 border",
      className
    )}
  />
);

// Two people on one thumbnail, each in one of the theme's two accents.
// Each cursor hangs off what it points at, so nothing drifts as the tile
// resizes. Decorative: the bento tile describes it in words.
export const CollabMock = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={cn(
      "bg-card relative flex aspect-video flex-col justify-end gap-2 rounded-2xl p-6 shadow-sm",
      className
    )}
  >
    <div className="bg-muted absolute inset-y-6 right-6 w-2/5 overflow-hidden rounded-xl">
      <div className="bg-muted-foreground/15 absolute -inset-x-1/4 -bottom-1/3 h-2/3 rounded-t-full" />
      <Cursor tone="secondary" className="top-1/4 left-4">
        Jonas
      </Cursor>
    </div>
    <div className="relative flex w-1/2 flex-col gap-2 p-2">
      <div className="bg-foreground h-4 w-full rounded-full sm:h-5" />
      <div className="bg-foreground h-4 w-3/4 rounded-full sm:h-5" />
      <div className="border-foreground absolute inset-0 border">
        <Handle className="-top-1 -left-1" />
        <Handle className="-top-1 -right-1" />
        <Handle className="-bottom-1 -left-1" />
        <Handle className="-right-1 -bottom-1" />
      </div>
      <Cursor tone="primary" className="top-full left-full">
        Jay
      </Cursor>
    </div>
    <div className="bg-muted-foreground/30 ml-2 h-3 w-1/4 rounded-full" />
  </div>
);
