"use client";

import {
  RiDeleteBinLine,
  RiFileCopyLine,
  RiLockLine,
  RiLockUnlockLine,
} from "@remixicon/react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { IconAction } from "@/components/editor/panels/icon-action";
import type { DesignElement } from "@/lib/document/schema";
import {
  duplicateElements,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";

// Properties of several selected elements at once
export const SelectionProperties = ({
  elements,
}: {
  elements: DesignElement[];
}) => {
  const store = useEditorStoreApi();
  const unlocked = elements
    .filter((element) => !element.locked)
    .map((element) => element.id);
  const lockedCount = elements.length - unlocked.length;
  const allLocked = unlocked.length === 0;

  const setLocked = (locked: boolean) =>
    store.getState().change((doc) => {
      let next = doc;
      for (const element of elements) {
        next = updateElement(next, element.id, { locked });
      }
      return next;
    });

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
    </>
  );
};
