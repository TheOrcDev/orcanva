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
  RiArrowDownSLine,
  RiArrowRightLine,
  RiArrowRightSLine,
  RiCheckboxBlankCircleLine,
  RiCheckboxBlankLine,
  RiDraggable,
  RiEmotionLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFolderLine,
  RiImageLine,
  RiLockLine,
  RiLockUnlockLine,
  RiShapeLine,
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
import { reorderElements, updateElement } from "@/lib/editor/document-ops";
import type { ElementPatch } from "@/lib/editor/document-ops";
import {
  flattenLayers,
  layerItems,
  layerKey,
  moveLayer,
} from "@/lib/editor/layers";
import type { LayerItem } from "@/lib/editor/layers";
import { toggleSelected, toggleUnit } from "@/lib/editor/selection";
import { selectDocument } from "@/lib/editor/store";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<ElementType, RemixiconComponentType> = {
  arrow: RiArrowRightLine,
  ellipse: RiCheckboxBlankCircleLine,
  frame: RiShapeLine,
  graphic: RiEmotionLine,
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
  dropDisabled = false,
}: {
  element: DesignElement;
  selected: boolean;
  // While another level of the list is dragged
  dropDisabled?: boolean;
}) => {
  const store = useEditorStoreApi();
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
  } = useSortable({ disabled: { droppable: dropDisabled }, id: element.id });
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
        onClick={(event) => {
          const state = store.getState();
          state.select(
            event.shiftKey || event.metaKey || event.ctrlKey
              ? toggleSelected(state.selectedIds, element.id)
              : [element.id]
          );
        }}
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

const ROW_CLASS = cn(
  "relative flex translate-x-(--dx) translate-y-(--dy) flex-col rounded-xl transition-transform duration-200",
  "data-[dragging=true]:bg-background data-[dragging=true]:z-10 data-[dragging=true]:shadow-md data-[dragging=true]:transition-none"
);

// A group: one row that selects, shows, hides and locks all its members,
// and moves them as a block; open it to see and reorder the members
const GroupRow = ({
  item,
  selectedIds,
  open,
  onToggleOpen,
  dropDisabled,
  membersDropDisabled,
}: {
  item: Extract<LayerItem, { kind: "group" }>;
  selectedIds: readonly string[];
  open: boolean;
  onToggleOpen: () => void;
  dropDisabled: boolean;
  membersDropDisabled: boolean;
}) => {
  const store = useEditorStoreApi();
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
  } = useSortable({
    disabled: { droppable: dropDisabled },
    id: layerKey(item),
  });
  const ids = item.members.map((member) => member.id);
  const selected = ids.every((id) => selectedIds.includes(id));
  const visible = item.members.every((member) => member.visible);
  const locked = item.members.every((member) => member.locked);
  const label = `Group of ${ids.length}`;

  const updateAll = (patch: ElementPatch) =>
    store.getState().change((doc) => {
      let next = doc;
      for (const id of ids) {
        next = updateElement(next, id, patch);
      }
      return next;
    });

  return (
    <li
      ref={setNodeRef}
      data-dragging={isDragging}
      className={ROW_CLASS}
      style={{
        "--dx": `${transform?.x ?? 0}px`,
        "--dy": `${transform?.y ?? 0}px`,
      }}
    >
      <div
        data-selected={selected}
        className="hover:bg-muted data-[selected=true]:bg-muted flex items-center gap-1 rounded-xl px-1 py-1"
      >
        <Button
          ref={setActivatorNodeRef}
          variant="ghost"
          size="icon-xs"
          aria-label={`Reorder ${label}`}
          className="cursor-grab"
          {...attributes}
          {...listeners}
        >
          <RiDraggable />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={open ? `Close ${label}` : `Open ${label}`}
          aria-expanded={open}
          onClick={onToggleOpen}
        >
          {open ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
        </Button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left text-sm outline-none focus-visible:ring-2"
          aria-pressed={selected}
          onClick={(event) => {
            const state = store.getState();
            state.select(
              event.shiftKey || event.metaKey || event.ctrlKey
                ? toggleUnit(state.selectedIds, ids)
                : ids
            );
          }}
        >
          <RiFolderLine
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          <span className="truncate">{label}</span>
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          onClick={() => updateAll({ visible: !visible })}
        >
          {visible ? <RiEyeLine /> : <RiEyeOffLine />}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
          onClick={() => updateAll({ locked: !locked })}
        >
          {locked ? <RiLockLine /> : <RiLockUnlockLine />}
        </Button>
      </div>
      {open ? (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="ml-5 flex flex-col gap-0.5" aria-label={label}>
            {item.members.map((member) => (
              <LayerRow
                key={member.id}
                element={member}
                selected={selectedIds.includes(member.id)}
                dropDisabled={membersDropDisabled}
              />
            ))}
          </ul>
        </SortableContext>
      ) : null}
    </li>
  );
};

export const LayersPanel = () => {
  const store = useEditorStoreApi();
  const document = useEditor(selectDocument);
  const selectedIds = useEditor((state) => state.selectedIds);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  // The row being dragged: rows only drop among their own level
  const [dragging, setDragging] = useState<string | null>(null);
  // Top of the list is the top of the stack (end of the elements array)
  const layers = layerItems(document);
  const draggingGroup =
    layers.find(
      (item) =>
        item.kind === "group" &&
        item.members.some((member) => member.id === dragging)
    ) ?? null;
  const draggingTopLevel = dragging !== null && draggingGroup === null;

  const toggleOpen = (groupId: string) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (!next.delete(groupId)) {
        next.add(groupId);
      }
      return next;
    });

  // Rows move past each other at the top level (a group as one block), and
  // members within their group
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over || active.id === over.id) {
      return;
    }
    const state = store.getState();
    const moved = moveLayer(
      layerItems(selectDocument(state)),
      String(active.id),
      String(over.id)
    );
    if (moved) {
      state.change((doc) => reorderElements(doc, flattenLayers(moved)));
    }
  };

  if (document.elements.length === 0) {
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
        onDragStart={({ active }) => setDragging(String(active.id))}
        onDragCancel={() => setDragging(null)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={layers.map(layerKey)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-0.5" aria-label="Layers">
            {layers.map((layer) =>
              layer.kind === "group" ? (
                <GroupRow
                  key={layerKey(layer)}
                  item={layer}
                  selectedIds={selectedIds}
                  open={openGroups.has(layer.groupId)}
                  onToggleOpen={() => toggleOpen(layer.groupId)}
                  dropDisabled={draggingGroup !== null}
                  membersDropDisabled={
                    draggingTopLevel ||
                    (draggingGroup !== null && draggingGroup !== layer)
                  }
                />
              ) : (
                <LayerRow
                  key={layer.element.id}
                  element={layer.element}
                  selected={selectedIds.includes(layer.element.id)}
                  dropDisabled={draggingGroup !== null}
                />
              )
            )}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="text-muted-foreground text-xs">
        Drag to reorder. Double-click a name to rename it. Shift-click to select
        several.
      </p>
    </PanelSection>
  );
};
