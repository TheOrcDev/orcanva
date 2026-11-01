"use client";

import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { boxOf } from "@/components/editor/canvas/snap-targets";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import type { Rect } from "@/lib/document/geometry";
import { expandToGroups } from "@/lib/editor/groups";
import {
  boxSelection,
  rectFromCorners,
  selectableIds,
} from "@/lib/editor/selection";
import { selectDocument } from "@/lib/editor/store";

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

// Dragging across empty canvas draws a box that selects everything it
// touches as it grows, with whole groups. Shift adds to what was already
// selected.
export const useSelectionBox = () => {
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();
  // The box in stage pixels while it's drawn
  const [box, setBox] = useState<Rect | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  const startBox = useCallback(
    (stage: Konva.Stage, additive: boolean) => {
      const page = pageNodeRef.current;
      const start = stage.getPointerPosition();
      if (!(page && start)) {
        return;
      }
      stopRef.current?.();
      const state = store.getState();
      const base = additive ? state.selectedIds : [];
      const boxes = new Map<string, Rect>();
      for (const id of selectableIds(selectDocument(state))) {
        const node = page.findOne(`#${id}`);
        if (node) {
          boxes.set(id, boxOf(node, page));
        }
      }
      const toPage = page.getAbsoluteTransform().copy().invert();

      const move = (event: PointerEvent) => {
        const bounds = stage.container().getBoundingClientRect();
        const point = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        };
        setBox(rectFromCorners(start, point));
        const area = rectFromCorners(toPage.point(start), toPage.point(point));
        const next = expandToGroups(
          selectDocument(store.getState()),
          boxSelection(base, boxes, area)
        );
        if (!sameIds(next, store.getState().selectedIds)) {
          store.getState().select(next);
        }
      };
      const stop = () => {
        setBox(null);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        stopRef.current = null;
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
      stopRef.current = stop;
    },
    [pageNodeRef, store]
  );

  return { box, startBox };
};
