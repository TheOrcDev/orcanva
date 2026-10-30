"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  RiArrowRightLine,
  RiCheckboxBlankCircleLine,
  RiCheckboxBlankLine,
  RiDraggable,
  RiEyeLine,
  RiEyeOffLine,
  RiImageLine,
  RiLockLine,
  RiLockUnlockLine,
  RiStackLine,
  RiSubtractLine,
  RiText,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { useState } from "react";
import type { KeyboardEvent } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import type { DesignElement, ElementType } from "@/lib/document/schema";
import { moveElementTo, updateElement } from "@/lib/editor/document-ops";
import type { ElementPatch } from "@/lib/editor/document-ops";
import { selectDocument } from "@/lib/editor/store";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<ElementType, RemixiconComponentType> = {
  arrow: RiArrowRightLine,
  ellipse: RiCheckboxBlankCircleLine,
  image: RiImageLine,
  line: RiSubtractLine,
  rect: RiCheckboxBlankLine,
  text: RiText,
};

const LayerName = ({
  element,
  onRename,
}: {
  element: DesignElement;
  onRename: (name: string) => void;
}) => {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <span
        className="min-w-0 flex-1 truncate text-sm"
        title="Double-click to rename"
        onDoubleClick={() => setDraft(element.name)}
      >
        {element.name}
      </span>
    );
  }

  const commit = () => {
    const name = draft.trim().slice(0, 120);
    setDraft(null);
    if (name && name !== element.name) {
      onRename(name);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commit();
    }
    if (event.key === "Escape") {
      setDraft(null);
    }
  };

  return (
    <Input
      autoFocus
      aria-label="Layer name"
      className="h-7 min-w-0 flex-1"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  );
};

const LayerRow = ({
  element,
  selected,
}: {
  element: DesignElement;
  selected: boolean;
}) => {
  const store = useEditorStoreApi();
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
  } = useSortable({ id: element.id });
  const Icon = TYPE_ICONS[element.type];

  const update = (patch: ElementPatch) =>
    store.getState().change((doc) => updateElement(doc, element.id, patch));

  return (
    <li
      ref={setNodeRef}
      data-dragging={isDragging}
      data-selected={selected}
      className={cn(
        "relative flex translate-x-(--dx) translate-y-(--dy) items-center gap-1 rounded-xl px-1 py-1 transition-transform duration-200",
        "hover:bg-muted data-[selected=true]:bg-muted data-[dragging=true]:bg-background data-[dragging=true]:z-10 data-[dragging=true]:shadow-md data-[dragging=true]:transition-none",
        !element.visible && "text-muted-foreground"
      )}
      style={{
        "--dx": `${transform?.x ?? 0}px`,
        "--dy": `${transform?.y ?? 0}px`,
      }}
    >
      <Button
        ref={setActivatorNodeRef}
        variant="ghost"
        size="icon-xs"
        aria-label={`Reorder ${element.name}`}
        className="cursor-grab"
        {...attributes}
        {...listeners}
      >
        <RiDraggable />
      </Button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left outline-none focus-visible:ring-2"
        aria-pressed={selected}
        onClick={() => store.getState().select([element.id])}
      >
        <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <LayerName element={element} onRename={(name) => update({ name })} />
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={
          element.visible ? `Hide ${element.name}` : `Show ${element.name}`
        }
        onClick={() => update({ visible: !element.visible })}
      >
        {element.visible ? <RiEyeLine /> : <RiEyeOffLine />}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={
          element.locked ? `Unlock ${element.name}` : `Lock ${element.name}`
        }
        onClick={() => update({ locked: !element.locked })}
      >
        {element.locked ? <RiLockLine /> : <RiLockUnlockLine />}
      </Button>
    </li>
  );
};

export const LayersPanel = () => {
  const store = useEditorStoreApi();
  const elements = useEditor((state) => selectDocument(state).elements);
  const selectedIds = useEditor((state) => state.selectedIds);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Top of the list is the top of the stack (end of the elements array)
  const layers = elements.toReversed();

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const displayIndex = layers.findIndex((layer) => layer.id === over.id);
    if (displayIndex === -1) {
      return;
    }
    const arrayIndex = elements.length - 1 - displayIndex;
    store
      .getState()
      .change((doc) => moveElementTo(doc, String(active.id), arrayIndex));
  };

  if (layers.length === 0) {
    return (
      <PanelSection title="Layers">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiStackLine />
            </EmptyMedia>
            <EmptyTitle>No layers yet</EmptyTitle>
            <EmptyDescription>
              Add images, text, or shapes and they&apos;ll stack up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Layers">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={layers.map((layer) => layer.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-0.5" aria-label="Layers">
            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                element={layer}
                selected={selectedIds.includes(layer.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="text-muted-foreground text-xs">
        Drag to reorder. Double-click a name to rename it.
      </p>
    </PanelSection>
  );
};
