"use client";

import { useEditor } from "@/components/editor/editor-store-context";
import { ElementProperties } from "@/components/editor/panels/element-properties";
import { PageProperties } from "@/components/editor/panels/page-properties";
import { SelectionProperties } from "@/components/editor/panels/selection-properties";
import { ScrollArea } from "@/components/ui/scroll-area";
import { selectDocument } from "@/lib/editor/store";

const SelectedProperties = () => {
  const selectedIds = useEditor((state) => state.selectedIds);
  const elements = useEditor((state) => selectDocument(state).elements);
  const selected = elements.filter((element) =>
    selectedIds.includes(element.id)
  );
  const [single] = selected;

  if (selected.length > 1) {
    return <SelectionProperties elements={selected} />;
  }
  if (single) {
    return <ElementProperties key={single.id} element={single} />;
  }
  return <PageProperties />;
};

export const PropertiesPanel = () => (
  <aside
    className="bg-background flex w-72 shrink-0 flex-col border-l"
    aria-label="Properties"
  >
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-6 p-4">
        <SelectedProperties />
      </div>
    </ScrollArea>
  </aside>
);
