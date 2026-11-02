"use client";

import { useEffect } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import {
  arrangeElements,
  duplicateElements,
  findElement,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";
import type { ArrangeDirection } from "@/lib/editor/document-ops";
import { groupElements, ungroupElements } from "@/lib/editor/groups";
import { selectableIds } from "@/lib/editor/selection";
import type { EditorStoreApi } from "@/lib/editor/store";
import { selectDocument } from "@/lib/editor/store";

const ZOOM_STEP = 1.25;
const NUDGE_SETTLE_MS = 500;
const NUDGE_SMALL = 1;
const NUDGE_LARGE = 10;

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
};

export const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT");

// Popovers, menus, and dialogs own their keys (Escape closes them, arrows
// move focus); the editor must not also act on those keystrokes
const POPUP_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

export const isInsidePopup = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(POPUP_SELECTOR) !== null;

const editableSelection = (store: EditorStoreApi): string[] => {
  const state = store.getState();
  const document = selectDocument(state);
  return state.selectedIds.filter((id) => {
    const element = findElement(document, id);
    return element !== undefined && !element.locked;
  });
};

const arrangeSelection = (
  store: EditorStoreApi,
  direction: ArrangeDirection
) => {
  const ids = editableSelection(store);
  if (ids.length > 0) {
    store.getState().change((doc) => arrangeElements(doc, ids, direction));
  }
};

const createNudger = (store: EditorStoreApi) => {
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  // Held or repeated arrows within the settle window are one undo step
  return (dx: number, dy: number) => {
    const ids = editableSelection(store);
    if (ids.length === 0) {
      return;
    }
    const state = store.getState();
    state.begin();
    state.change((doc) => {
      let next = doc;
      for (const id of ids) {
        const element = findElement(next, id);
        if (element) {
          next = updateElement(next, id, {
            x: element.x + dx,
            y: element.y + dy,
          });
        }
      }
      return next;
    });
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => store.getState().end(), NUDGE_SETTLE_MS);
  };
};

const handleModifierShortcut = (
  event: KeyboardEvent,
  store: EditorStoreApi
): boolean => {
  const state = store.getState();
  const key = event.key.toLowerCase();

  if (key === "z") {
    if (event.shiftKey) {
      state.redo();
    } else {
      state.undo();
    }
    return true;
  }
  if (key === "y") {
    state.redo();
    return true;
  }
  if (key === "a") {
    state.select(selectableIds(selectDocument(state)));
    return true;
  }
  if (key === "g") {
    const ids = state.selectedIds;
    if (event.shiftKey) {
      state.change((doc) => ungroupElements(doc, ids));
    } else if (ids.length > 1) {
      state.change((doc) => groupElements(doc, ids));
    }
    return true;
  }
  if (key === "d") {
    const ids = editableSelection(store);
    if (ids.length > 0) {
      let created: string[] = [];
      state.change((doc) => {
        const result = duplicateElements(doc, ids);
        created = result.ids;
        return result.document;
      });
      store.getState().select(created);
    }
    return true;
  }
  if (event.code === "BracketRight") {
    arrangeSelection(store, event.shiftKey ? "front" : "forward");
    return true;
  }
  if (event.code === "BracketLeft") {
    arrangeSelection(store, event.shiftKey ? "back" : "backward");
    return true;
  }
  if (key === "=" || key === "+") {
    state.setZoom(state.zoom * ZOOM_STEP);
    return true;
  }
  if (key === "-") {
    state.setZoom(state.zoom / ZOOM_STEP);
    return true;
  }
  if (key === "0") {
    state.zoomToFit();
    return true;
  }
  return false;
};

const handlePlainShortcut = (
  event: KeyboardEvent,
  store: EditorStoreApi,
  nudge: (dx: number, dy: number) => void
): boolean => {
  const state = store.getState();

  if (event.key === "Escape") {
    state.clearSelection();
    return true;
  }
  if (event.key === "Enter") {
    const [id] = editableSelection(store);
    const element = id ? findElement(selectDocument(state), id) : undefined;
    if (element?.type === "text") {
      state.setEditingText(element.id);
      return true;
    }
    return false;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    const ids = editableSelection(store);
    if (ids.length > 0) {
      state.change((doc) => removeElements(doc, ids));
    }
    return true;
  }
  const delta = ARROW_DELTAS[event.key];
  if (delta) {
    const step = event.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
    nudge(delta[0] * step, delta[1] * step);
    return true;
  }
  return false;
};

export const useEditorShortcuts = () => {
  const store = useEditorStoreApi();

  useEffect(() => {
    const nudge = createNudger(store);

    const handleKeyDown = (event: KeyboardEvent) => {
      // Text editing and cropping handle their own keys
      if (
        isTypingTarget(event.target) ||
        isInsidePopup(event.target) ||
        store.getState().editingTextId ||
        store.getState().cropTargetId ||
        store.getState().pageCrop
      ) {
        return;
      }
      const hasModifier = event.metaKey || event.ctrlKey;
      const handled = hasModifier
        ? handleModifierShortcut(event, store)
        : !event.altKey && handlePlainShortcut(event, store, nudge);
      if (handled) {
        event.preventDefault();
      }
    };

    // Capture phase so the editor wins over page-level hotkeys
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [store]);
};
