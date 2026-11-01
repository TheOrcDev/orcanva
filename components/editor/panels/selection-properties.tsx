"use client";

import {
  RiDeleteBinLine,
  RiFileCopyLine,
  RiLockLine,
  RiLockUnlockLine,
} from "@remixicon/react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import {
  ALIGN_ACTIONS,
  ARRANGE_ACTIONS,
  DISTRIBUTE_ACTIONS,
} from "@/components/editor/panels/arrange-actions";
import { IconAction } from "@/components/editor/panels/icon-action";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { useAlign } from "@/hooks/use-align";
import type { DesignElement } from "@/lib/document/schema";
import {
  arrangeElements,
  duplicateElements,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";
import type { ElementPatch } from "@/lib/editor/document-ops";

// Properties of several selected elements at once
export const SelectionProperties = ({
  elements,
}: {
  elements: DesignElement[];
}) => {
  const store = useEditorStoreApi();
  const { align, distribute } = useAlign();
  const unlocked = elements
    .filter((element) => !element.locked)
    .map((element) => element.id);
  const lockedCount = elements.length - unlocked.length;
  const allLocked = unlocked.length === 0;

  const updateAll = (patch: ElementPatch, ids: readonly string[]) =>
    store.getState().change((doc) => {
      let next = doc;
      for (const id of ids) {
        next = updateElement(next, id, patch);
      }
      return next;
    });
  const setLocked = (locked: boolean) =>
    updateAll(
      { locked },
      elements.map((element) => element.id)
    );
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
            {elements.length} elements
          </span>
          <span className="text-muted-foreground text-xs">
            {lockedCount > 0 ? `${lockedCount} locked` : "Selection"}
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
      <p className="text-muted-foreground text-xs">
        Drag any of them to move them together. Shift-click an element to add or
        remove it.
      </p>

      <PanelSection title="Align">
        <div className="flex flex-wrap gap-1">
          {ALIGN_ACTIONS.map((action) => (
            <IconAction
              key={action.edge}
              label={action.label}
              icon={action.icon}
              disabled={unlocked.length < 2}
              onClick={() => align(unlocked, action.edge, "selection")}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {DISTRIBUTE_ACTIONS.map((action) => (
            <IconAction
              key={action.axis}
              label={action.label}
              icon={action.icon}
              disabled={unlocked.length < 3}
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
