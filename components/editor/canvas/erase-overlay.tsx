"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Circle, Group, Rect, Shape } from "react-konva";
import { useStore } from "zustand";

import { PhotoImage } from "@/components/editor/canvas/photo-node";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import {
  ERASE_FAILED,
  runEraseAction,
} from "@/components/editor/erase-toolbar";
import { isTypingTarget } from "@/hooks/use-editor-shortcuts";
import type { Point } from "@/lib/document/geometry";
import type { PhotoElement } from "@/lib/document/schema";
import { findElement } from "@/lib/editor/document-ops";
import type { EraseMode } from "@/lib/editor/magic-eraser";
import { TOOL_UI_NAME } from "@/lib/editor/node-names";
import { selectDocument } from "@/lib/editor/store";
import { drawStrokes } from "@/lib/magic-eraser/erase";
import { assetToLocal, localToAsset } from "@/lib/magic-eraser/geometry";
import type { PhotoPlacement } from "@/lib/magic-eraser/geometry";
import { pendingStrokes } from "@/lib/magic-eraser/session";
import type { Stroke } from "@/lib/magic-eraser/session";

const ACCENT = "#2563eb";
const STROKES_ATTR = "eraseStrokes";
// Covers the whole canvas around the photo, in page pixels
const EVERYWHERE = 1_000_000;

// Never painted: a shape with both a fill and a stroke is drawn through a
// buffer while it's see-through, so overlapping strokes fade as one layer
// instead of darkening where they cross (as GraphicNode does)
const BUFFER_PAINT = {
  fill: "#000000",
  perfectDrawEnabled: true,
  stroke: "#000000",
  strokeWidth: 0.001,
} as const;

const drawBrushStrokes = (context: Konva.Context, shape: Konva.Shape) => {
  const strokes = shape.getAttr(STROKES_ATTR) as Stroke[] | undefined;
  const native = context._context;
  native.strokeStyle = ACCENT;
  drawStrokes(native, strokes ?? []);
};

// How the photo being erased sits in the element (see localToAsset)
const placementOf = (
  element: PhotoElement,
  canvas: HTMLCanvasElement | null
): PhotoPlacement => ({
  box: { height: element.height, width: element.width },
  crop: element.crop,
  flipX: element.flipX,
  flipY: element.flipY,
  photo: { height: canvas?.height ?? 1, width: canvas?.width ?? 1 },
});

// Keys that act on a focused control themselves
const ownsEnter = (target: EventTarget | null) =>
  isTypingTarget(target) ||
  (target instanceof HTMLElement && target.closest("button") !== null);

// The magic eraser over one image, in the element's own space: the photo as
// erased so far (cropped, filtered and flipped like the image), the strokes
// waiting for Erase as half-see-through accent lines clipped to the box, and
// a brush cursor. Strokes are kept in the photo's own pixels, so the mask
// lines up with the file. Presses anywhere else on the canvas do nothing.
export const EraseOverlay = ({
  element,
  mode,
  zoom,
}: {
  element: PhotoElement;
  mode: EraseMode;
  zoom: number;
}) => {
  const editor = useEditorStoreApi();
  const groupRef = useRef<Konva.Group>(null);
  const canvas = useStore(mode, (state) => state.canvas);
  const session = useStore(mode, (state) => state.session);
  const brush = useStore(mode, (state) => state.brush);
  const busy = useStore(mode, (state) => state.busy);
  // The stroke being painted, and where the brush is (element space)
  const painting = useRef<Stroke | null>(null);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);

  const { flipX, flipY, height, width } = element;
  const placement = placementOf(element, canvas);
  const transform = assetToLocal(placement);
  // Brush radius in photo pixels: screen → page (zoom) → photo
  const radius = brush / 2 / zoom / Math.abs(transform.scaleX);

  const brushPoint = () => {
    const local = groupRef.current?.getRelativePointerPosition() ?? null;
    return local ? localToAsset(local, placement) : null;
  };

  // A stroke goes on outside the photo too, until the button comes up.
  // The element and photo are read as each event comes, so a crop or flip
  // changed meanwhile is followed.
  const elementId = element.id;
  useEffect(() => {
    const stage = groupRef.current?.getStage();
    if (!stage) {
      return;
    }
    const move = () => {
      const local = groupRef.current?.getRelativePointerPosition() ?? null;
      setPointer(local);
      const stroke = painting.current;
      const now = findElement(selectDocument(editor.getState()), elementId);
      if (
        !(stroke && local && (now?.type === "image" || now?.type === "frame"))
      ) {
        return;
      }
      const point = localToAsset(
        local,
        placementOf(now, mode.getState().canvas)
      );
      painting.current = { ...stroke, points: [...stroke.points, point] };
      setCurrent(painting.current);
    };
    const up = () => {
      const stroke = painting.current;
      painting.current = null;
      setCurrent(null);
      if (stroke) {
        mode.getState().addStroke(stroke);
      }
    };
    stage.on("pointermove.erase", move);
    stage.on("pointerup.erase pointercancel.erase", up);
    return () => {
      stage.off(".erase");
    };
  }, [editor, elementId, mode]);

  // Enter erases, Esc closes without saving, ⌘Z and ⇧⌘Z step through this
  // session's strokes and erases; the editor's own shortcuts sit out
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        mode.getState().cancel();
      } else if (event.key === "Enter" && !ownsEnter(event.target)) {
        runEraseAction(editor, mode.getState().erase, ERASE_FAILED).catch(
          () => null
        );
      } else if (mod && (key === "z" || key === "y")) {
        if (event.shiftKey || key === "y") {
          mode.getState().redo();
        } else {
          mode.getState().undo();
        }
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [editor, mode]);

  const startStroke = (event: Konva.KonvaEventObject<PointerEvent>) => {
    const point = brushPoint();
    if (!(point && canvas) || busy || event.evt.button > 0) {
      return;
    }
    painting.current = { points: [point], radius };
    setCurrent(painting.current);
  };

  const strokes = current
    ? [...pendingStrokes(session), current]
    : pendingStrokes(session);

  return (
    <>
      {/* Swallows presses around the photo */}
      <Rect
        name={TOOL_UI_NAME}
        x={-EVERYWHERE}
        y={-EVERYWHERE}
        width={EVERYWHERE * 2}
        height={EVERYWHERE * 2}
        fill="rgba(0, 0, 0, 0)"
      />
      <Group
        ref={groupRef}
        name={TOOL_UI_NAME}
        x={element.x}
        y={element.y}
        rotation={element.rotation}
        onPointerDown={startStroke}
        onPointerLeave={() => setPointer(null)}
      >
        <Group clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
          {canvas ? (
            <PhotoImage
              image={canvas}
              width={width}
              height={height}
              crop={element.crop}
              filter={element.filter}
              flipX={flipX}
              flipY={flipY}
              cornerRadius={element.type === "image" ? element.cornerRadius : 0}
            />
          ) : (
            <Rect width={width} height={height} fill="#e4e4e7" />
          )}
          <Group {...transform} listening={false}>
            <Shape
              {...BUFFER_PAINT}
              opacity={0.5}
              listening={false}
              sceneFunc={drawBrushStrokes}
              // Read back as STROKES_ATTR
              eraseStrokes={strokes}
            />
          </Group>
        </Group>
        <Rect
          width={width}
          height={height}
          stroke={ACCENT}
          strokeWidth={1 / zoom}
          listening={false}
        />
        {pointer && canvas && !busy ? (
          <Circle
            x={pointer.x}
            y={pointer.y}
            radius={brush / 2 / zoom}
            stroke="#ffffff"
            strokeWidth={1.5 / zoom}
            shadowColor="#000000"
            shadowBlur={2}
            shadowOpacity={0.6}
            listening={false}
          />
        ) : null}
      </Group>
    </>
  );
};
