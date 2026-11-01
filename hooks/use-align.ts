"use client";

import { useCallback } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { boxOf } from "@/components/editor/canvas/snap-targets";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { alignUnits, distributeUnits } from "@/lib/editor/align";
import type { AlignEdge, AlignUnit, DistributeAxis } from "@/lib/editor/align";
import { selectionUnits } from "@/lib/editor/groups";
import { unionRect } from "@/lib/editor/snapping";
import { selectDocument } from "@/lib/editor/store";

// Aligning and distributing work on the boxes the canvas draws, which know
// rotation and text height. A group moves as one.
export const useAlign = () => {
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();

  const measure = useCallback(
    (ids: readonly string[]): AlignUnit[] => {
      const page = pageNodeRef.current;
      if (!page) {
        return [];
      }
      const document = selectDocument(store.getState());
      return selectionUnits(document, ids).flatMap((unit) => {
        const box = unionRect(
          unit.flatMap((id) => {
            const node = page.findOne(`#${id}`);
            return node ? [boxOf(node, page)] : [];
          })
        );
        return box ? [{ box, ids: unit }] : [];
      });
    },
    [pageNodeRef, store]
  );

  // To the selection's own box, or to the page
  const align = useCallback(
    (ids: readonly string[], edge: AlignEdge, to: "selection" | "page") => {
      const units = measure(ids);
      const { height, width } = selectDocument(store.getState());
      const reference =
        to === "page"
          ? { height, width, x: 0, y: 0 }
          : unionRect(units.map((unit) => unit.box));
      if (reference && units.length > 0) {
        store
          .getState()
          .change((doc) => alignUnits(doc, units, edge, reference));
      }
    },
    [measure, store]
  );

  const distribute = useCallback(
    (ids: readonly string[], axis: DistributeAxis) => {
      const units = measure(ids);
      store.getState().change((doc) => distributeUnits(doc, units, axis));
    },
    [measure, store]
  );

  return { align, distribute };
};
