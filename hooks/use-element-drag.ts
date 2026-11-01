"use client";

import type Konva from "konva";
import { useCallback, useEffect, useRef } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import {
  boxOf,
  collectSnapTargets,
  isFreeMove,
} from "@/components/editor/canvas/snap-targets";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { MAX_DRAG_MOVES } from "@/lib/collab/presence";
import type { Point, Rect } from "@/lib/document/geometry";
import type { DesignDocument } from "@/lib/document/schema";
import { findElement, updateElement } from "@/lib/editor/document-ops";
import { photoIntoFrame } from "@/lib/editor/frames";
import { editableSelection } from "@/lib/editor/selection";
import {
  NO_SNAP,
  SNAP_DISTANCE_PX,
  offsetRect,
  snapBox,
  unionRect,
} from "@/lib/editor/snapping";
import { selectDocument } from "@/lib/editor/store";

// A drag's last positions keep going out briefly after the drop, so others
// switch from the preview to the committed move without a jump back
const DRAG_PREVIEW_LINGER_MS = 500;

// One drag of one element, or of a whole selection
interface DragGesture {
  // The element under the pointer; Konva's Transformer drags the rest
  primary: string;
  ids: string[];
  // The page point under the pointer when it went down
  press: Point | null;
  // Each moving element's position when the drag began
  starts: Map<string, Point>;
  // Around everything that moves, in page coordinates
  box: Rect | null;
  // The page and every other visible element
  targets: Rect[];
  // Drop positions, collected as Konva ends each node's drag
  dropped: Map<string, Point>;
  // A lone image being dragged: dropped on a frame, its photo fills it
  photoId: string | null;
}

// The topmost unlocked frame under a point in stage pixels, other than the
// dragged element itself
const frameUnder = (
  page: Konva.Group,
  document: DesignDocument,
  point: Point,
  exclude: string
): string | null => {
  for (const element of document.elements.toReversed()) {
    if (
      element.type !== "frame" ||
      element.locked ||
      !element.visible ||
      element.id === exclude
    ) {
      continue;
    }
    const node = page.findOne(`#${element.id}`);
    const local = node?.getAbsoluteTransform().copy().invert().point(point);
    if (
      local &&
      local.x >= 0 &&
      local.y >= 0 &&
      local.x <= element.width &&
      local.y <= element.height
    ) {
      return element.id;
    }
  }
  return null;
};

// Moving elements on the canvas: snapping, the live preview others see, and
// one committed change (one undo step) for everything that moved
export const useElementDrag = () => {
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();
  // Where the pointer went down, in stage pixels. Drags measure from it, so
  // every element of a selection moves by the same snapped amount even though
  // Konva drags each one with its own pointer offset.
  const pressRef = useRef<Point | null>(null);
  const gestureRef = useRef<DragGesture | null>(null);
  const previewEndRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  useEffect(() => () => clearTimeout(previewEndRef.current), []);

  const recordPress = useCallback((point: Point | null) => {
    pressRef.current = point;
  }, []);

  const startDrag = useCallback(
    (id: string) => {
      // The rest of a selection starts once the Transformer moves it
      if (gestureRef.current) {
        return;
      }
      const page = pageNodeRef.current;
      const press = pressRef.current;
      const state = store.getState();
      const document = selectDocument(state);
      const ids = state.selectedIds.includes(id)
        ? editableSelection(document, state.selectedIds).map(
            (element) => element.id
          )
        : [id];
      const starts = new Map<string, Point>();
      const boxes: Rect[] = [];
      for (const movingId of ids) {
        const node = page?.findOne(`#${movingId}`);
        if (page && node) {
          starts.set(movingId, node.position());
          boxes.push(boxOf(node, page));
        }
      }
      const lone = ids.length === 1 ? findElement(document, id) : undefined;
      gestureRef.current = {
        box: unionRect(boxes),
        dropped: new Map(),
        ids,
        photoId: lone?.type === "image" ? lone.id : null,
        press:
          page && press
            ? page.getAbsoluteTransform().copy().invert().point(press)
            : null,
        primary: id,
        starts,
        targets: page ? collectSnapTargets(page, document, new Set(ids)) : [],
      };
      // Konva owns the nodes while they move; holding them keeps remote
      // updates from moving them mid-gesture
      state.hold(ids);
    },
    [pageNodeRef, store]
  );

  // Konva asks where a dragged node may go (in stage pixels)
  const boundDrag = useCallback(
    (id: string, position: Point, event: unknown): Point => {
      const page = pageNodeRef.current;
      const gesture = gestureRef.current;
      const start = gesture?.starts.get(id);
      const pointer = page?.getStage()?.getPointerPosition();
      if (!(page && gesture?.press && gesture.box && start && pointer)) {
        return position;
      }
      const toStage = page.getAbsoluteTransform();
      const now = toStage.copy().invert().point(pointer);
      const moved = { x: now.x - gesture.press.x, y: now.y - gesture.press.y };
      const snap = isFreeMove(event)
        ? NO_SNAP
        : snapBox(
            offsetRect(gesture.box, moved),
            gesture.targets,
            SNAP_DISTANCE_PX / page.scaleX()
          );
      store.getState().setGuides(snap.guides);
      return toStage.point({
        x: start.x + moved.x + snap.dx,
        y: start.y + moved.y + snap.dy,
      });
    },
    [pageNodeRef, store]
  );

  // Others watch the selection move before it's committed
  const moveDrag = useCallback(
    (id: string) => {
      const page = pageNodeRef.current;
      const gesture = gestureRef.current;
      if (!(page && gesture) || id !== gesture.primary) {
        return;
      }
      const moves = gesture.ids.slice(0, MAX_DRAG_MOVES).flatMap((movingId) => {
        const node = page.findOne(`#${movingId}`);
        return node ? [{ elementId: movingId, ...node.position() }] : [];
      });
      clearTimeout(previewEndRef.current);
      store.getState().setDragPreview({ moves });
      const pointer = page.getStage()?.getPointerPosition();
      if (gesture.photoId && pointer) {
        store
          .getState()
          .setDropTarget(
            frameUnder(
              page,
              selectDocument(store.getState()),
              pointer,
              gesture.photoId
            )
          );
      }
    },
    [pageNodeRef, store]
  );

  const finish = useCallback(
    (gesture: DragGesture) => {
      if (gestureRef.current === gesture) {
        gestureRef.current = null;
      }
      const state = store.getState();
      const frameId = gesture.photoId ? state.dropTargetId : null;
      const image = gesture.photoId
        ? findElement(selectDocument(state), gesture.photoId)
        : undefined;
      const photo =
        image?.type === "image"
          ? state.assets.find((asset) => asset.id === image.assetId)
          : undefined;
      if (frameId && image && photo) {
        // Into the frame: one change, one undo step
        state.change((doc) => photoIntoFrame(doc, image.id, frameId, photo));
        state.select([frameId]);
      } else {
        state.change((doc) => {
          let next = doc;
          for (const [id, position] of gesture.dropped) {
            next = updateElement(next, id, position);
          }
          return next;
        });
      }
      state.setDropTarget(null);
      state.release(gesture.ids);
      state.setGuides([]);
      clearTimeout(previewEndRef.current);
      previewEndRef.current = setTimeout(() => {
        store.getState().setDragPreview(null);
      }, DRAG_PREVIEW_LINGER_MS);
    },
    [store]
  );

  // Konva ends every node of a selection drag in one loop, so the drop is
  // committed once they all reported in
  const endDrag = useCallback(
    (id: string, position: Point) => {
      const gesture = gestureRef.current;
      if (!gesture) {
        return;
      }
      gesture.dropped.set(id, position);
      if (gesture.dropped.size === 1) {
        queueMicrotask(() => finish(gesture));
      }
    },
    [finish]
  );

  return { boundDrag, endDrag, moveDrag, recordPress, startDrag };
};
