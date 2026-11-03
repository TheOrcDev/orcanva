"use client";

import { RiCheckLine, RiGalleryLine } from "@remixicon/react";
import { useState, useTransition } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { listCompareDesigns } from "@/lib/actions/preview";
import type { CompareDesign } from "@/lib/actions/preview";
import { stopIfOutdated } from "@/lib/editor/outdated";
import { cn } from "@/lib/utils";

// The signed-in person's other designs, by their gallery previews, to
// compare this one with. Guests have no designs of their own, so it's
// hidden for them. The list loads each time it opens.
export const CompareDesignsPicker = ({
  chosenIds,
  full,
  onToggle,
}: {
  chosenIds: readonly string[];
  // No room for another compare
  full: boolean;
  onToggle: (design: CompareDesign) => void;
}) => {
  const store = useEditorStoreApi();
  const designId = useEditor((state) => state.designId);
  const signedIn = useEditor((state) => state.viewer !== null);
  const [designs, setDesigns] = useState<CompareDesign[] | null>(null);
  const [isLoading, startLoading] = useTransition();

  if (!signedIn) {
    return null;
  }

  const load = () => {
    startLoading(async () => {
      try {
        setDesigns(await listCompareDesigns(designId));
      } catch (error) {
        if (!stopIfOutdated(store, error)) {
          toast.add({ title: "Couldn't load your designs", type: "error" });
        }
      }
    });
  };

  const content = () => {
    if (designs === null) {
      return (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
          <Spinner />
          Loading your designs…
        </div>
      );
    }
    if (designs.length === 0) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No other designs yet</EmptyTitle>
            <EmptyDescription>
              Designs show here once they have a gallery preview.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }
    return (
      <ul className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto p-1">
        {designs.map((design) => {
          const chosen = chosenIds.includes(design.id);
          return (
            <li key={design.id}>
              <button
                type="button"
                aria-pressed={chosen}
                disabled={full && !chosen}
                onClick={() => onToggle(design)}
                className={cn(
                  "hover:ring-ring focus-visible:ring-ring flex w-full flex-col gap-1 rounded-xl p-1 text-left transition-shadow outline-none hover:ring-2 focus-visible:ring-2 disabled:opacity-50 disabled:hover:ring-0",
                  chosen && "ring-primary ring-2"
                )}
              >
                <span className="bg-muted relative block aspect-video overflow-hidden rounded-lg">
                  {/* oxlint-disable-next-line nextjs/no-img-element -- storage URLs */}
                  <img
                    src={design.thumbnailUrl}
                    alt=""
                    className="size-full object-contain"
                  />
                  {chosen ? (
                    <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-full">
                      <RiCheckLine className="size-4" />
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-xs">{design.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          load();
        }
      }}
    >
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        {isLoading ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <RiGalleryLine data-icon="inline-start" />
        )}
        My designs
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Compare with a design</PopoverTitle>
          <PopoverDescription>
            Their gallery previews, which catch up a few seconds after an edit.
          </PopoverDescription>
        </PopoverHeader>
        {content()}
      </PopoverContent>
    </Popover>
  );
};
