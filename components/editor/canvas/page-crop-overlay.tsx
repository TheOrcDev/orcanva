"use client";

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Group, Rect, Shape, Transformer } from "react-konva";

import { CROP_UI_NAME } from "@/components/editor/canvas/crop-overlay";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { isInsidePopup, isTypingTarget } from "@/hooks/use-editor-shortcuts";
import type { Point, Rect as Box, Size } from "@/lib/document/geometry";
import { MIN_CANVAS_SIZE } from "@/lib/document/schema";
import { keepBoxInPage, limitCropBox } from "@/lib/editor/page-crop";

const ACCENT = "#2563eb";
const DIM = "rgba(15, 23, 42, 0.55)";
// Thirds lines: a light line over a dark one, seen on any colour
const GRID = "rgba(255, 255, 255, 0.8)";
const GRID_SHADOW = "rgba(15, 23, 42, 0.3)";
// The box stays big enough on screen to grab
const MIN_BOX_SCREEN = 24;
const THIRDS = [1 / 3, 2 / 3];

const CORNER_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const ALL_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-right",
  "middle-left",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

// Keys meant for a field, a menu or the crop's own toolbar (focus stays on
// the panel's Crop button, so Enter there still applies the crop)
const isForControl = (target: EventTarget | null): boolean =>
  isTypingTarget(target) ||
  isInsidePopup(target) ||
  (target instanceof Element && target.closest('[role="toolbar"]') !== null);

// A box as Konva's Transformer measures it, in stage pixels
interface StageBox extends Box {
  rotation: number;
}

// Crop mode for the whole page, drawn over it in page coordinates: the box
// is the part that stays and the rest is dimmed. The box lives in the store
// and the page only changes when the crop is applied, so a cancelled crop
// leaves no trace.
export const PageCropOverlay = ({
  box,
  page,
  ratio,
  zoom,
}: {
  box: Box;
  page: Size;
  // Width over height the box keeps, or null when it's free
  ratio: number | null;
  zoom: number;
}) => {
  const store = useEditorStoreApi();
  const groupRef = useRef<Konva.Group>(null);
  const boxRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const transformer = transformerRef.current;
    const boxNode = boxRef.current;
    if (transformer && boxNode) {
      transformer.nodes([boxNode]);
      transformer.getLayer()?.batchDraw();
    }
  }, []);

  // Enter applies the crop and Escape leaves the page as it was; the
  // editor's own shortcuts sit out while cropping
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key !== "Enter" && event.key !== "Escape") ||
        isForControl(event.target)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      store.getState().finishPageCrop(event.key === "Enter");
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [store]);

  // Between stage pixels (what Konva hands its bound functions) and the page
  const toPage = (point: Point): Point =>
    groupRef.current?.getAbsoluteTransform().copy().invert().point(point) ??
    point;
  const toStage = (point: Point): Point =>
    groupRef.current?.getAbsoluteTransform().point(point) ?? point;

  const boundDrag = (position: Point): Point =>
    toStage(keepBoxInPage({ ...box, ...toPage(position) }, page));

  const moveBox = () => {
    const node = boxRef.current;
    if (node) {
      store.getState().setPageCrop({ ...box, x: node.x(), y: node.y() });
    }
  };

  const boundResize = (previous: StageBox, next: StageBox): StageBox => {
    const anchor = transformerRef.current?.getActiveAnchor();
    if (!anchor) {
      return next;
    }
    const inPage = (stageBox: StageBox): Box => ({
      ...toPage(stageBox),
      height: stageBox.height / zoom,
      width: stageBox.width / zoom,
    });
    const limited = limitCropBox({
      anchor,
      min: Math.max(MIN_CANVAS_SIZE, MIN_BOX_SCREEN / zoom),
      next: inPage(next),
      page,
      previous: inPage(previous),
      ratio,
    });
    return {
      ...next,
      ...toStage(limited),
      height: limited.height * zoom,
      width: limited.width * zoom,
    };
  };

  // The handles resize the box node; its size goes back into the store
  const resizeBox = () => {
    const node = boxRef.current;
    if (!node) {
      return;
    }
    const next = {
      height: node.height() * node.scaleY(),
      width: node.width() * node.scaleX(),
      x: node.x(),
      y: node.y(),
    };
    node.setAttrs({ ...next, scaleX: 1, scaleY: 1 });
    store.getState().setPageCrop(next);
  };

  return (
    <>
      <Group ref={groupRef} name={CROP_UI_NAME}>
        {/* Takes presses on the dimmed part, so they don't reach elements */}
        <Rect width={page.width} height={page.height} />
        <Shape
          listening={false}
          sceneFunc={(context) => {
            const native = context._context;
            native.beginPath();
            native.rect(0, 0, page.width, page.height);
            native.rect(box.x, box.y, box.width, box.height);
            native.fillStyle = DIM;
            native.fill("evenodd");
          }}
        />
        {/* Thirds, for lining up what's kept */}
        <Shape
          listening={false}
          sceneFunc={(context) => {
            const native = context._context;
            native.beginPath();
            for (const third of THIRDS) {
              const x = box.x + box.width * third;
              const y = box.y + box.height * third;
              native.moveTo(x, box.y);
              native.lineTo(x, box.y + box.height);
              native.moveTo(box.x, y);
              native.lineTo(box.x + box.width, y);
            }
            native.strokeStyle = GRID_SHADOW;
            native.lineWidth = 2 / zoom;
            native.stroke();
            native.strokeStyle = GRID;
            native.lineWidth = 1 / zoom;
            native.stroke();
          }}
        />
        <Rect
          ref={boxRef}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          draggable
          dragBoundFunc={boundDrag}
          onDragMove={moveBox}
          onDragEnd={moveBox}
          onTransform={resizeBox}
          onTransformEnd={resizeBox}
        />
      </Group>
      <Transformer
        ref={transformerRef}
        name={CROP_UI_NAME}
        anchorCornerRadius={3}
        anchorFill="#ffffff"
        anchorSize={10}
        anchorStroke={ACCENT}
        borderStroke={ACCENT}
        boundBoxFunc={boundResize}
        // A locked shape resizes from its corners, and Shift can't free it
        enabledAnchors={ratio === null ? ALL_ANCHORS : CORNER_ANCHORS}
        flipEnabled={false}
        ignoreStroke
        keepRatio={ratio !== null}
        shiftBehavior={ratio === null ? "default" : "none"}
        rotateEnabled={false}
      />
    </>
  );
};
