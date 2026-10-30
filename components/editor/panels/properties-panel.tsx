"use client";

import { ElementProperties } from "@/components/editor/panels/element-properties";
import { PageProperties } from "@/components/editor/panels/page-properties";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSelectedElement } from "@/hooks/use-selected-element";

export const PropertiesPanel = () => {
  const selected = useSelectedElement();

  return (
    <aside
      className="bg-background flex w-72 shrink-0 flex-col border-l"
      aria-label="Properties"
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-6 p-4">
          {selected ? (
            <ElementProperties key={selected.id} element={selected} />
          ) : (
            <PageProperties />
          )}
        </div>
      </ScrollArea>
    </aside>
  );
};
