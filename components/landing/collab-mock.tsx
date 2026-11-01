import { RiCursorFill } from "@remixicon/react";
import type { ReactNode } from "react";

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
  tone: "strong" | "muted";
}) => (
  <div className={cn("absolute flex items-start", className)}>
    <RiCursorFill
      className={cn(
        "-mt-1 -ml-1 size-5",
        tone === "strong" ? "text-solid" : "text-ink-muted"
      )}
    />
    <span
      className={cn(
        "mt-3 rounded-full px-2.5 py-1 text-xs",
        tone === "strong" ? "bg-solid text-on-solid" : "bg-ink-muted text-paper"
      )}
    >
      {children}
    </span>
  </div>
);

const Handle = ({ className }: { className: string }) => (
  <span
    className={cn("border-ink bg-surface absolute size-2 border", className)}
  />
);

// Two people on one thumbnail, drawn in greys so the painting stays the
// page's only colour. Each cursor hangs off what it points at, so nothing
// drifts as the panel resizes. Decorative: the section describes it in words.
export const CollabMock = () => (
  <div aria-hidden className="bg-panel rounded-3xl p-6 sm:p-10">
    <div className="bg-surface relative flex aspect-video flex-col justify-end gap-2 rounded-2xl p-6">
      <div className="bg-panel absolute inset-y-6 right-6 w-2/5 overflow-hidden rounded-xl">
        <div className="bg-rule/25 absolute -inset-x-1/4 -bottom-1/3 h-2/3 rounded-t-full" />
        <Cursor tone="muted" className="top-1/4 left-4">
          Jonas
        </Cursor>
      </div>
      <div className="relative flex w-1/2 flex-col gap-2 p-2">
        <div className="bg-ink h-4 w-full rounded-full sm:h-5" />
        <div className="bg-ink h-4 w-3/4 rounded-full sm:h-5" />
        <div className="border-ink absolute inset-0 border">
          <Handle className="-top-1 -left-1" />
          <Handle className="-top-1 -right-1" />
          <Handle className="-bottom-1 -left-1" />
          <Handle className="-right-1 -bottom-1" />
        </div>
        <Cursor tone="strong" className="top-full left-full">
          Mila
        </Cursor>
      </div>
      <div className="bg-rule/50 ml-2 h-3 w-1/4 rounded-full" />
    </div>
  </div>
);
