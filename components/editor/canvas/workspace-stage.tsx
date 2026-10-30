"use client";

import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Group, Layer, Rect, Stage } from "react-konva";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { BackgroundNode } from "@/components/editor/canvas/background-node";
import { ElementNode } from "@/components/editor/canvas/element-node";
import { LineHandles } from "@/components/editor/canvas/line-handles";
import { SelectionTransformer } from "@/components/editor/canvas/selection-transformer";
import { TextEditOverlay } from "@/components/editor/canvas/text-edit-overlay";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Spinner } from "@/components/ui/spinner";
import { useUpload } from "@/hooks/use-upload";
import { createImageElement } from "@/lib/document/factories";
import { fitZoom } from "@/lib/document/geometry";
import type { DesignElement } from "@/lib/document/schema";
import { bakeBoxTransform, bakeTextTransform } from "@/lib/editor/bake";
import type { NodeTransform } from "@/lib/editor/bake";
import {
  insertElement,
  replaceElement,
  updateElement,
} from "@/lib/editor/document-ops";
import { ASSET_DRAG_TYPE } from "@/lib/editor/drag-data";
import { MAX_ZOOM, MIN_ZOOM, selectDocument } from "@/lib/editor/store";

const PINCH_ZOOM_SPEED = 0.01;

const isAcceptedDrag = (event: DragEvent<HTMLDivElement>) =>
  event.dataTransfer.types.includes("Files") ||
  event.dataTransfer.types.includes(ASSET_DRAG_TYPE);

const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
  if (!isAcceptedDrag(event)) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
};

const isLinear = (element: DesignElement) =>
  element.type === "line" || element.type === "arrow";

const bakeTransform = (
  element: DesignElement,
  transform: NodeTransform,
  node: Konva.Node
): DesignElement => {
  switch (element.type) {
    case "image":
    case "rect":
    case "ellipse": {
      return bakeBoxTransform(element, transform);
    }
    case "text": {
      const textNode = (node as Konva.Group).findOne("Text");
      return bakeTextTransform(
        element,
        transform,
        textNode?.width() ?? element.width
      );
    }
    default: {
      return { ...element, x: transform.x, y: transform.y };
    }
  }
};

// Drop hint while files are dragged over the editor, and upload progress
const WorkspaceOverlays = () => {
  const fileDragActive = useEditor((state) => state.fileDragActive);
  const uploadsInFlight = useEditor((state) => state.uploadsInFlight);
  const removingBackground = useEditor(
    (state) => state.backgroundJobs.length > 0
  );
  const noun = uploadsInFlight === 1 ? "image" : "images";

  return (
    <>
      {fileDragActive ? (
        <div className="border-primary bg-primary/5 pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed">
          <span className="bg-background rounded-full px-4 py-2 text-sm font-medium shadow-sm">
            Drop images to add them to your design
          </span>
        </div>
      ) : null}
      {uploadsInFlight > 0 ? (
        <output className="bg-background absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm shadow-md">
          <Spinner />
          Uploading {uploadsInFlight} {noun}…
        </output>
      ) : null}
      {removingBackground && uploadsInFlight === 0 ? (
        <output className="bg-background absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm shadow-md">
          <Spinner />
          Removing background…
        </output>
      ) : null}
    </>
  );
};

export const WorkspaceStage = () => {
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ height: 0, width: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const upload = useUpload();

  const document = useEditor(selectDocument);
  const zoom = useEditor((state) => state.zoom);
  const zoomMode = useEditor((state) => state.zoomMode);
  const selectedIds = useEditor((state) => state.selectedIds);
  const editingTextId = useEditor((state) => state.editingTextId);

  const { height: pageHeight, width: pageWidth } = document;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setViewport({
          height: entry.contentRect.height,
          width: entry.contentRect.width,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (zoomMode !== "fit" || viewport.width === 0) {
      return;
    }
    store
      .getState()
      .setFitZoom(fitZoom({ height: pageHeight, width: pageWidth }, viewport));
  }, [store, zoomMode, viewport, pageWidth, pageHeight]);

  // Fit mode always centers the page; pan only applies after manual zoom/pan
  const effectivePan = zoomMode === "fit" ? { x: 0, y: 0 } : pan;
  const origin = {
    x: (viewport.width - pageWidth * zoom) / 2 + effectivePan.x,
    y: (viewport.height - pageHeight * zoom) / 2 + effectivePan.y,
  };

  const selectElement = useCallback(
    (id: string) => {
      const state = store.getState();
      if (state.selectedIds.length !== 1 || state.selectedIds[0] !== id) {
        state.select([id]);
      }
    },
    [store]
  );

  const moveElement = useCallback(
    (id: string, position: { x: number; y: number }) => {
      store.getState().change((doc) => updateElement(doc, id, position));
    },
    [store]
  );

  const editText = useCallback(
    (id: string) => {
      const state = store.getState();
      state.select([id]);
      state.setEditingText(id);
    },
    [store]
  );

  const clearSelection = useCallback(() => {
    store.getState().clearSelection();
  }, [store]);

  const handleTransformEnd = useCallback(
    (element: DesignElement, transform: NodeTransform, node: Konva.Node) => {
      const baked = bakeTransform(element, transform, node);
      store.getState().change((doc) => replaceElement(doc, baked));
    },
    [store]
  );

  const handleStageMouseDown = (
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (event.target === event.target.getStage()) {
      clearSelection();
    }
  };

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const { ctrlKey, deltaX, deltaY, metaKey } = event.evt;

    if (!(ctrlKey || metaKey)) {
      setPan({ x: effectivePan.x - deltaX, y: effectivePan.y - deltaY });
      if (zoomMode === "fit") {
        store.getState().setZoom(zoom);
      }
      return;
    }

    // Pinch or Cmd+scroll: zoom around the pointer
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) {
      return;
    }
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, zoom * Math.exp(-deltaY * PINCH_ZOOM_SPEED))
    );
    const pagePoint = {
      x: (pointer.x - origin.x) / zoom,
      y: (pointer.y - origin.y) / zoom,
    };
    const centered = {
      x: (viewport.width - pageWidth * nextZoom) / 2,
      y: (viewport.height - pageHeight * nextZoom) / 2,
    };
    setPan({
      x: pointer.x - pagePoint.x * nextZoom - centered.x,
      y: pointer.y - pagePoint.y * nextZoom - centered.y,
    });
    store.getState().setZoom(nextZoom);
  };

  const selected =
    selectedIds.length === 1
      ? document.elements.find((element) => element.id === selectedIds[0])
      : undefined;
  const editingElement = editingTextId
    ? document.elements.find((element) => element.id === editingTextId)
    : undefined;
  const editingText =
    editingElement?.type === "text" ? editingElement : undefined;
  const selectedLine =
    (selected?.type === "line" || selected?.type === "arrow") &&
    !selected.locked
      ? selected
      : undefined;
  const transformTarget =
    selected && !isLinear(selected) && selected.id !== editingTextId
      ? selected
      : null;

  // Files from the desktop upload; library assets place directly. Both land
  // where the pointer is, converted from screen to page coordinates.
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!isAcceptedDrag(event)) {
      return;
    }
    // Marks the drop handled so the editor-wide fallback doesn't repeat it
    event.preventDefault();
    store.getState().setFileDragActive(false);
    const bounds = event.currentTarget.getBoundingClientRect();
    const at = {
      x: (event.clientX - bounds.left - origin.x) / zoom,
      y: (event.clientY - bounds.top - origin.y) / zoom,
    };

    const assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE);
    if (assetId) {
      const state = store.getState();
      const asset = state.assets.find((item) => item.id === assetId);
      if (asset) {
        const element = createImageElement(
          asset,
          { height: pageHeight, width: pageWidth },
          at
        );
        state.change((doc) => insertElement(doc, element));
        state.select([element.id]);
      }
      return;
    }
    upload([...event.dataTransfer.files], at).catch(() => null);
  };

  return (
    <div
      ref={containerRef}
      className="bg-muted/60 relative min-h-0 min-w-0 flex-1 overflow-hidden"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <WorkspaceOverlays />
      {viewport.width > 0 && viewport.height > 0 ? (
        <Stage
          width={viewport.width}
          height={viewport.height}
          onMouseDown={handleStageMouseDown}
          onTouchStart={handleStageMouseDown}
          onWheel={handleWheel}
        >
          <Layer>
            <Rect
              x={origin.x}
              y={origin.y}
              width={pageWidth * zoom}
              height={pageHeight * zoom}
              fill="#ffffff"
              shadowColor="#000000"
              shadowBlur={24}
              shadowOpacity={0.12}
              shadowOffsetY={4}
              listening={false}
            />
            <Group
              ref={pageNodeRef}
              x={origin.x}
              y={origin.y}
              scaleX={zoom}
              scaleY={zoom}
              clipX={0}
              clipY={0}
              clipWidth={pageWidth}
              clipHeight={pageHeight}
            >
              <BackgroundNode
                background={document.background}
                width={pageWidth}
                height={pageHeight}
                onSelectPage={clearSelection}
              />
              {document.elements.map((element) => (
                <ElementNode
                  key={element.id}
                  element={element}
                  onSelect={selectElement}
                  onMove={moveElement}
                  onEditText={editText}
                />
              ))}
            </Group>
          </Layer>
          <Layer>
            {selectedLine ? (
              <Group x={origin.x} y={origin.y} scaleX={zoom} scaleY={zoom}>
                <LineHandles element={selectedLine} zoom={zoom} />
              </Group>
            ) : null}
            <SelectionTransformer
              element={transformTarget}
              onTransformEnd={handleTransformEnd}
            />
          </Layer>
        </Stage>
      ) : null}
      {editingText ? (
        <TextEditOverlay
          key={editingText.id}
          element={editingText}
          origin={origin}
          zoom={zoom}
        />
      ) : null}
    </div>
  );
};
