"use client";

import {
  RiDeleteBinLine,
  RiFileCopyLine,
  RiLockLine,
  RiLockUnlockLine,
} from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import {
  ALIGN_ACTIONS,
  ARRANGE_ACTIONS,
  DISTRIBUTE_ACTIONS,
} from "@/components/editor/panels/arrange-actions";
import { IconAction } from "@/components/editor/panels/icon-action";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { Button } from "@/components/ui/button";
import { useAlign } from "@/hooks/use-align";
import type { DesignElement } from "@/lib/document/schema";
import {
  arrangeElements,
  duplicateElements,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";
import type { ElementPatch } from "@/lib/editor/document-ops";
import {
  groupElements,
  selectedGroup,
  selectionUnits,
  ungroupElements,
} from "@/lib/editor/groups";
import { selectDocument } from "@/lib/editor/store";

// Properties of several selected elements at once
export const SelectionProperties = ({
  elements,
}: {
  elements: DesignElement[];
}) => {
  const store = useEditorStoreApi();
  const { align, distribute } = useAlign();
  const document = useEditor(selectDocument);
  const ids = elements.map((element) => element.id);
  const group = selectedGroup(document, ids);
  const unlocked = elements
    .filter((element) => !element.locked)
    .map((element) => element.id);
  const lockedCount = elements.length - unlocked.length;
  const allLocked = unlocked.length === 0;
  // One group (or one element) aligns to the page, like a single element
  const units = selectionUnits(document, unlocked).length;
  const alignTo = units > 1 ? "selection" : "page";

  const toggleGroup = () =>
    store
      .getState()
      .change((doc) =>
        group ? ungroupElements(doc, ids) : groupElements(doc, ids)
      );

  const updateAll = (patch: ElementPatch, targets: readonly string[]) =>
    store.getState().change((doc) => {
      let next = doc;
      for (const id of targets) {
        next = updateElement(next, id, patch);
      }
      return next;
    });
  const setLocked = (locked: boolean) => updateAll({ locked }, ids);
  const [first] = elements;
  const opacity = first?.opacity ?? 1;
  const mixedOpacity = elements.some((element) => element.opacity !== opacity);

  const duplicate = () => {
    let created: string[] = [];
    store.getState().change((doc) => {
      const result = duplicateElements(doc, unlocked);
      created = result.ids;
      return result.document;
    });
    store.getState().select(created);
  };

  const remove = () =>
    store.getState().change((doc) => removeElements(doc, unlocked));

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {group ? "Group" : `${elements.length} elements`}
          </span>
          <span className="text-muted-foreground text-xs">
            {lockedCount > 0
              ? `${lockedCount} locked`
              : `${group ? `${elements.length} elements` : "Selection"}`}
          </span>
        </div>
        <div className="flex gap-1">
          <IconAction
            label={allLocked ? "Unlock all" : "Lock all"}
            icon={allLocked ? RiLockUnlockLine : RiLockLine}
            onClick={() => setLocked(!allLocked)}
          />
          <IconAction
            label="Duplicate (⌘D)"
            icon={RiFileCopyLine}
            onClick={duplicate}
            disabled={allLocked}
          />
          <IconAction
            label="Delete (⌫)"
            icon={RiDeleteBinLine}
            onClick={remove}
            disabled={allLocked}
          />
        </div>
      </div>
      <Button variant="outline" onClick={toggleGroup}>
        {group ? "Ungroup (⇧⌘G)" : "Group (⌘G)"}
      </Button>
      <p className="text-muted-foreground text-xs">
        {group
          ? "Click a grouped element again to select just that one."
          : "Drag any of them to move them together. Shift-click an element to add or remove it."}
      </p>

      <PanelSection title="Align">
        <div className="flex flex-wrap gap-1">
          {ALIGN_ACTIONS.map((action) => (
            <IconAction
              key={action.edge}
              label={action.label}
              icon={action.icon}
              disabled={units === 0}
              onClick={() => align(unlocked, action.edge, alignTo)}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {DISTRIBUTE_ACTIONS.map((action) => (
            <IconAction
              key={action.axis}
              label={action.label}
              icon={action.icon}
              disabled={units < 3}
              onClick={() => distribute(unlocked, action.axis)}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Arrange">
        <div className="flex gap-1">
          {ARRANGE_ACTIONS.map((action) => (
            <IconAction
              key={action.direction}
              label={`${action.label} (${action.shortcut})`}
              icon={action.icon}
              disabled={allLocked}
              onClick={() =>
                store
                  .getState()
                  .change((doc) =>
                    arrangeElements(doc, unlocked, action.direction)
                  )
              }
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Layer">
        <TransactionSlider
          label="Opacity"
          value={Math.round(opacity * 100)}
          min={0}
          max={100}
          format={(value) => (mixedOpacity ? "Mixed" : `${value}%`)}
          onChange={(value) => updateAll({ opacity: value / 100 }, unlocked)}
        />
      </PanelSection>
    </>
  );
};
