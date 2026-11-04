"use client";

import type Konva from "konva";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import type {
  DragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent,
} from "react";
import { Group, Layer, Rect, Stage } from "react-konva";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { BackgroundNode } from "@/components/editor/canvas/background-node";
import { CropOverlay } from "@/components/editor/canvas/crop-overlay";
import { ElementNode } from "@/components/editor/canvas/element-node";
import type { LiveCrop } from "@/components/editor/canvas/element-node";
import { EraseOverlay } from "@/components/editor/canvas/erase-overlay";
import { LineHandles } from "@/components/editor/canvas/line-handles";
import { PageCropOverlay } from "@/components/editor/canvas/page-crop-overlay";
import { RemoteSelections } from "@/components/editor/canvas/remote-selections";
import { SelectionOutline } from "@/components/editor/canvas/selection-outline";
import { SelectionTransformer } from "@/components/editor/canvas/selection-transformer";
import type { TransformedElement } from "@/components/editor/canvas/selection-transformer";
import { selectionView } from "@/components/editor/canvas/selection-view";
import { SnapGuides } from "@/components/editor/canvas/snap-guides";
import { TextEditOverlay } from "@/components/editor/canvas/text-edit-overlay";
import { TEXT_BODY_NAME } from "@/components/editor/canvas/text-node";
import { RemoteCursors } from "@/components/editor/collab/remote-cursors";
import { CommentPins } from "@/components/editor/comments/comment-pins";
import { CropToolbar } from "@/components/editor/crop-toolbar";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { EraseToolbar } from "@/components/editor/erase-toolbar";
import { PageCropToolbar } from "@/components/editor/page-crop-toolbar";
import {
  BadgeGuide,
  CornerPreview,
} from "@/components/editor/youtube-preview-overlays";
import { Spinner } from "@/components/ui/spinner";
import { useElementDrag } from "@/hooks/use-element-drag";
import { useEraseMode } from "@/hooks/use-erase-mode";
import { usePeersHere } from "@/hooks/use-peers-here";
import { useSelectionBox } from "@/hooks/use-selection-box";
import { useUpload } from "@/hooks/use-upload";
import { anchorFor, pinPoint } from "@/lib/comments/anchor";
import { refitFrameCrop } from "@/lib/document/crop";
import {
  createGraphicElement,
  createImageElement,
} from "@/lib/document/factories";
import { fitZoom } from "@/lib/document/geometry";
import type { Point } from "@/lib/document/geometry";
import type { DesignElement } from "@/lib/document/schema";
import {
  bakeBoxTransform,
  bakeLineTransform,
  bakeTextTransform,
} from "@/lib/editor/bake";
import type { NodeTransform } from "@/lib/editor/bake";
import {
  findElement,
  insertElement,
  replaceElement,
} from "@/lib/editor/document-ops";
import { ASSET_DRAG_TYPE, GRAPHIC_DRAG_TYPE } from "@/lib/editor/drag-data";
import { fillFrame } from "@/lib/editor/frames";
import { unitOf } from "@/lib/editor/groups";
import {
  BACKGROUND_NODE_NAME,
  ELEMENT_NODE_NAME,
  LIVE_CROP_ATTR,
  isToolUi,
  photoNodeOf,
} from "@/lib/editor/node-names";
import { ratioValue } from "@/lib/editor/page-crop";
import { toggleUnit } from "@/lib/editor/selection";
import { MAX_ZOOM, MIN_ZOOM, selectDocument } from "@/lib/editor/store";
import type { ImageJob } from "@/lib/editor/store";
import { graphicEntrySchema } from "@/lib/graphics/entry";
import type { GraphicEntry } from "@/lib/graphics/entry";

const PINCH_ZOOM_SPEED = 0.01;

// How close to the workspace's edge a comment pin may be and still count as
// in view (screen pixels)
const PIN_VIEW_MARGIN = 80;

const isAcceptedDrag = (event: DragEvent<HTMLDivElement>) =>
  event.dataTransfer.types.includes("Files") ||
  event.dataTransfer.types.includes(ASSET_DRAG_TYPE) ||
  event.dataTransfer.types.includes(GRAPHIC_DRAG_TYPE);

// The graphic a drag carries, if it's one this tab can read
const draggedGraphic = (data: string): GraphicEntry | null => {
  if (!data) {
    return null;
  }
  try {
    const parsed = graphicEntrySchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
  if (!isAcceptedDrag(event)) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
};

const bakeTransform = (
  element: DesignElement,
  transform: NodeTransform,
  node: Konva.Node
): DesignElement => {
  switch (element.type) {
    case "image": {
      // A side handle cropped the photo live (see recropImage)
      const image = photoNodeOf(node as Konva.Group);
      const live = image?.getAttr(LIVE_CROP_ATTR) as LiveCrop | undefined;
      image?.setAttr(LIVE_CROP_ATTR, undefined);
      const baked = bakeBoxTransform(element, transform);
      return live ? { ...baked, ...live } : baked;
    }
    case "rect":
    case "ellipse":
    case "graphic": {
      return bakeBoxTransform(element, transform);
    }
    case "frame": {
      // The photo keeps covering the frame's new size
      const baked = bakeBoxTransform(element, transform);
      return element.assetId
        ? { ...baked, crop: refitFrameCrop(element, baked) }
        : baked;
    }
    case "text": {
      const textNode = (node as Konva.Group).findOne(`.${TEXT_BODY_NAME}`);
      // Curved text draws at its arc's size; its wrap width just scales
      const liveWidth =
        element.curve === 0
          ? (textNode?.width() ?? element.width)
          : element.width;
      return bakeTextTransform(element, transform, liveWidth);
    }
    case "line":
    case "arrow": {
      return bakeLineTransform(element, transform);
    }
    default: {
      return element;
    }
  }
};

const IMAGE_JOB_LABELS: Record<ImageJob, string> = {
  background: "Removing background…",
  erase: "Erasing…",
  upscale: "Upscaling…",
};

// Drop hint while files are dragged over the editor, and upload progress
const WorkspaceOverlays = () => {
  const fileDragActive = useEditor((state) => state.fileDragActive);
  const uploadsInFlight = useEditor((state) => state.uploadsInFlight);
  // The magic eraser's toolbar says what it's doing itself
  const imageJob = useEditor(
    (state) =>
      Object.values(state.imageJobs).find((job) => job !== "erase") ?? null
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
      {imageJob && uploadsInFlight === 0 ? (
        <output className="bg-background absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm shadow-md">
          <Spinner />
          {IMAGE_JOB_LABELS[imageJob]}
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
  const peers = usePeersHere();
  const held = useEditor((state) => state.held);
  const editingTextId = useEditor((state) => state.editingTextId);
  const cropTargetId = useEditor((state) => state.cropTargetId);
  const eraseTargetId = useEditor((state) => state.eraseTargetId);
  const eraseMode = useEraseMode();
  const dropTargetId = useEditor((state) => state.dropTargetId);
  const pageCrop = useEditor((state) => state.pageCrop);
  const pageCropRatio = useEditor((state) => state.pageCropRatio);
  const commentMode = useEditor((state) => state.commentMode);

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

  // Selecting something else (e.g. in Layers) ends typing
  useEffect(() => {
    if (editingTextId && !selectedIds.includes(editingTextId)) {
      store.getState().setEditingText(null);
    }
  }, [editingTextId, selectedIds, store]);

  // Someone deleted the image being cropped: close the crop's undo step
  useEffect(() => {
    if (
      cropTargetId &&
      !document.elements.some((element) => element.id === cropTargetId)
    ) {
      store.getState().finishCrop(true);
    }
  }, [cropTargetId, document, store]);

  // Someone deleted the image being erased: nothing left to save it to
  useEffect(() => {
    if (
      eraseTargetId &&
      !document.elements.some((element) => element.id === eraseTargetId)
    ) {
      store.getState().finishErase();
    }
  }, [eraseTargetId, document, store]);

  // Selecting something (e.g. in Layers) applies a page crop
  useEffect(() => {
    if (pageCrop && selectedIds.length > 0) {
      store.getState().finishPageCrop(true);
    }
  }, [pageCrop, selectedIds, store]);

  // Fit mode always centers the page; pan only applies after manual zoom/pan
  const effectivePan = zoomMode === "fit" ? { x: 0, y: 0 } : pan;
  const origin = {
    x: (viewport.width - pageWidth * zoom) / 2 + effectivePan.x,
    y: (viewport.height - pageHeight * zoom) / 2 + effectivePan.y,
  };

  const { boundDrag, endDrag, moveDrag, recordPress, startDrag } =
    useElementDrag();
  const { box: selectionBox, startBox } = useSelectionBox();

  // Pressing an element picks its whole group; Shift toggles that in or out.
  // Pressing something already selected keeps the selection, so it can be
  // dragged as a whole.
  const pressedSelectedRef = useRef(false);
  const pressElement = useCallback(
    (id: string, additive: boolean) => {
      const state = store.getState();
      const unit = unitOf(selectDocument(state), id);
      pressedSelectedRef.current = state.selectedIds.includes(id);
      if (additive) {
        state.select(toggleUnit(state.selectedIds, unit));
      } else if (!state.selectedIds.includes(id)) {
        state.select(unit);
      }
    },
    [store]
  );

  // Clicking (without dragging) something that was already selected narrows
  // the selection: to its group, or into the group to just that element
  const clickElement = useCallback(
    (id: string, additive: boolean) => {
      if (additive || !pressedSelectedRef.current) {
        return;
      }
      const state = store.getState();
      const unit = unitOf(selectDocument(state), id);
      const isUnit =
        unit.length === state.selectedIds.length &&
        unit.every((unitId) => state.selectedIds.includes(unitId));
      if (isUnit && unit.length > 1) {
        state.select([id]);
      } else if (!isUnit && state.selectedIds.length > 1) {
        state.select(unit);
      }
    },
    [store]
  );

  const cropImage = useCallback(
    (id: string) => store.getState().startCrop(id),
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

  // Konva owns nodes while they're transformed; holding them keeps remote
  // updates from moving them mid-gesture
  const holdTransformed = useCallback(
    (elements: DesignElement[]) =>
      store.getState().hold(elements.map((element) => element.id)),
    [store]
  );

  const handleTransformEnd = useCallback(
    (transformed: TransformedElement[]) => {
      const baked = transformed.map(({ element, node, transform }) => {
        const result = bakeTransform(element, transform, node);
        // React only sets props that changed, and a line's rotation stays 0
        // while its turn goes into its points: the node must drop it here
        node.rotation(result.rotation);
        return result;
      });
      const state = store.getState();
      state.change((doc) => {
        let next = doc;
        for (const element of baked) {
          next = replaceElement(next, element);
        }
        return next;
      });
      state.release(transformed.map(({ element }) => element.id));
    },
    [store]
  );

  // Pressing empty canvas clears the selection (unless Shift is held) and
  // starts a selection box
  const handleStageMouseDown = (
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    const stage = event.target.getStage();
    recordPress(stage?.getPointerPosition() ?? null);
    // Pressing anything but a tool's own UI keeps the crop and carries on
    if (!isToolUi(event.target)) {
      store.getState().finishCrop(true);
      store.getState().finishPageCrop(true);
    }
    // Pressing the canvas ends typing (the text itself sits under the
    // typing surface, which takes those presses)
    if (store.getState().editingTextId) {
      store.getState().setEditingText(null);
    }
    if (isToolUi(event.target)) {
      return;
    }
    const onEmpty =
      event.target === stage || event.target.hasName(BACKGROUND_NODE_NAME);
    if (!(stage && onEmpty)) {
      return;
    }
    const additive = event.evt.shiftKey;
    if (!additive) {
      store.getState().clearSelection();
    }
    if (!("button" in event.evt) || event.evt.button === 0) {
      startBox(stage, additive);
    }
  };

  // Scrolling pans; pinch or ⌘-scroll zooms around the pointer (in stage
  // pixels)
  const wheelAt = (event: WheelEvent, pointer: Point | null) => {
    const { ctrlKey, deltaX, deltaY, metaKey } = event;

    if (!(ctrlKey || metaKey)) {
      setPan({ x: effectivePan.x - deltaX, y: effectivePan.y - deltaY });
      if (zoomMode === "fit") {
        store.getState().setZoom(zoom);
      }
      return;
    }

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

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    wheelAt(event.evt, event.target.getStage()?.getPointerPosition() ?? null);
  };

  // Elements someone else on this page is dragging right now (not ones this
  // window holds)
  const previews = new Map(
    peers.flatMap((peer) =>
      (peer.drag?.moves ?? [])
        .filter((move) => !held.has(move.elementId))
        .map((move) => [move.elementId, move] as const)
    )
  );

  const {
    cropping,
    editingText,
    erasing,
    line: selectedLine,
    outlinedIds,
    transformTargets,
  } = selectionView(
    document,
    selectedIds,
    editingTextId,
    cropTargetId,
    eraseTargetId
  );

  // Where this session's pointer is on the page, for everyone else's view
  const reportPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    store.getState().setPointer({
      x: Math.round((event.clientX - bounds.left - origin.x) / zoom),
      y: Math.round((event.clientY - bounds.top - origin.y) / zoom),
    });
  };
  const clearPointer = () => store.getState().setPointer(null);

  // The element drawn under a point in the window, if any (hidden ones
  // aren't drawn)
  const elementAt = (
    clientX: number,
    clientY: number
  ): DesignElement | undefined => {
    const page = pageNodeRef.current;
    const layer = page?.getLayer();
    const stage = page?.getStage();
    if (!(layer && stage)) {
      return undefined;
    }
    const bounds = stage.container().getBoundingClientRect();
    const shape = layer.getIntersection({
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    });
    const node = shape?.findAncestor(`.${ELEMENT_NODE_NAME}`);
    return node
      ? findElement(selectDocument(store.getState()), node.id())
      : undefined;
  };

  // The unlocked frame under a point in the window, if any: photos dropped
  // there fill it
  const frameAt = (clientX: number, clientY: number): string | null => {
    const element = elementAt(clientX, clientY);
    return element?.type === "frame" && !element.locked ? element.id : null;
  };

  // A thread picked in the Comments tab (or a link to one): bring its pin
  // into view, centred, unless it already shows
  const bringPinIntoView = useEffectEvent((threadId: string) => {
    const state = store.getState();
    const root = state.comments.find((comment) => comment.id === threadId);
    if (!root || viewport.width === 0) {
      return;
    }
    const element =
      root.elementId === null
        ? undefined
        : findElement(selectDocument(state), root.elementId);
    const point = pinPoint(root, element);
    const screen = {
      x: origin.x + point.x * zoom,
      y: origin.y + point.y * zoom,
    };
    const margin = PIN_VIEW_MARGIN;
    const visible =
      screen.x >= margin &&
      screen.y >= margin &&
      screen.x <= viewport.width - margin &&
      screen.y <= viewport.height - margin;
    if (visible) {
      return;
    }
    setPan({
      x:
        viewport.width / 2 -
        point.x * zoom -
        (viewport.width - pageWidth * zoom) / 2,
      y:
        viewport.height / 2 -
        point.y * zoom -
        (viewport.height - pageHeight * zoom) / 2,
    });
    if (zoomMode === "fit") {
      state.setZoom(zoom);
    }
  });
  // A link's thread needs no panning: the page opens fitted, pins and all
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (
          state.focusRequest &&
          state.focusRequest !== previous.focusRequest
        ) {
          bringPinIntoView(state.focusRequest.threadId);
        }
      }),
    [store]
  );

  // Comment mode: a click on the page starts a new thread pinned there, on
  // the element under it if there's one (so the pin follows it). The layer
  // takes the click, so nothing on the canvas reacts to it.
  const placeComment = (event: ReactMouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = {
      x: (event.clientX - bounds.left - origin.x) / zoom,
      y: (event.clientY - bounds.top - origin.y) / zoom,
    };
    const onPage =
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= pageWidth &&
      point.y <= pageHeight;
    if (!onPage) {
      store.getState().placeDraft(null);
      return;
    }
    const element = elementAt(event.clientX, event.clientY);
    store.getState().placeDraft({
      anchor: element ? anchorFor(element, point) : null,
      pageId: null,
      x: point.x,
      y: point.y,
    });
  };

  // The comment layer covers the stage, so it passes scrolling and pinching
  // on (not passive, to keep the browser from zooming the page)
  const captureRef = useRef<HTMLDivElement>(null);
  const wheelOverCapture = useEffectEvent((event: WheelEvent) => {
    const bounds = captureRef.current?.getBoundingClientRect();
    event.preventDefault();
    wheelAt(
      event,
      bounds
        ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
        : null
    );
  });
  useEffect(() => {
    const layer = captureRef.current;
    if (!(commentMode && layer)) {
      return;
    }
    layer.addEventListener("wheel", wheelOverCapture, { passive: false });
    return () => layer.removeEventListener("wheel", wheelOverCapture);
  }, [commentMode]);

  // Files from the desktop upload; library assets and graphics place
  // directly. All land where the pointer is, converted from screen to page
  // coordinates.
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!isAcceptedDrag(event)) {
      return;
    }
    // Marks the drop handled so the editor-wide fallback doesn't repeat it
    event.preventDefault();
    store.getState().setFileDragActive(false);
    // The magic eraser keeps the canvas as it is until it's done
    if (store.getState().eraseTargetId) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const at = {
      x: (event.clientX - bounds.left - origin.x) / zoom,
      y: (event.clientY - bounds.top - origin.y) / zoom,
    };

    const graphic = draggedGraphic(
      event.dataTransfer.getData(GRAPHIC_DRAG_TYPE)
    );
    if (graphic) {
      const element = createGraphicElement(
        graphic,
        { height: pageHeight, width: pageWidth },
        at
      );
      const state = store.getState();
      state.change((doc) => insertElement(doc, element));
      state.select([element.id]);
      return;
    }

    const frameId = frameAt(event.clientX, event.clientY);
    const assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE);
    if (assetId) {
      const state = store.getState();
      const asset = state.assets.find((item) => item.id === assetId);
      if (asset && frameId) {
        state.change((doc) => fillFrame(doc, frameId, asset));
        state.select([frameId]);
      } else if (asset) {
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
    upload([...event.dataTransfer.files], at, frameId ?? undefined).catch(
      () => null
    );
  };

  return (
    <div
      ref={containerRef}
      className="bg-muted/60 relative min-h-0 min-w-0 flex-1 overflow-hidden"
      onDragOver={handleDragOver}
      onPointerMove={reportPointer}
      onPointerLeave={clearPointer}
      onDrop={handleDrop}
    >
      <WorkspaceOverlays />
      {cropping ? <CropToolbar element={cropping} /> : null}
      {erasing && eraseMode ? <EraseToolbar mode={eraseMode} /> : null}
      {pageCrop ? <PageCropToolbar box={pageCrop} /> : null}
      {commentMode && !pageCrop ? (
        // A mouse affordance; the Comments tab can start a thread too
        <div
          ref={captureRef}
          aria-hidden
          className="absolute inset-0 z-4 cursor-crosshair"
          onClick={placeComment}
        />
      ) : null}
      <CommentPins origin={origin} zoom={zoom} />
      <RemoteCursors origin={origin} zoom={zoom} />
      <BadgeGuide origin={origin} zoom={zoom} />
      <CornerPreview />
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
              />
              {document.elements.map((element) => (
                <ElementNode
                  key={element.id}
                  element={element}
                  onPress={pressElement}
                  onClick={clickElement}
                  onEditText={editText}
                  onCrop={cropImage}
                  onDragStart={startDrag}
                  onDragMove={moveDrag}
                  onDragEnd={endDrag}
                  onDragBound={boundDrag}
                  preview={previews.get(element.id) ?? null}
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
            {cropping ? (
              <Group x={origin.x} y={origin.y} scaleX={zoom} scaleY={zoom}>
                <CropOverlay key={cropping.id} element={cropping} zoom={zoom} />
              </Group>
            ) : null}
            {erasing && eraseMode ? (
              <Group x={origin.x} y={origin.y} scaleX={zoom} scaleY={zoom}>
                <EraseOverlay
                  key={erasing.id}
                  element={erasing}
                  mode={eraseMode}
                  zoom={zoom}
                />
              </Group>
            ) : null}
            {pageCrop ? (
              <Group x={origin.x} y={origin.y} scaleX={zoom} scaleY={zoom}>
                <PageCropOverlay
                  box={pageCrop}
                  page={{ height: pageHeight, width: pageWidth }}
                  ratio={ratioValue(pageCropRatio, document)}
                  zoom={zoom}
                />
              </Group>
            ) : null}
            <RemoteSelections />
            <SnapGuides origin={origin} zoom={zoom} />
            <SelectionOutline ids={outlinedIds} />
            {/* The frame a dragged photo would fill */}
            <SelectionOutline ids={dropTargetId ? [dropTargetId] : []} />
            <SelectionTransformer
              elements={transformTargets}
              onTransformStart={holdTransformed}
              onTransformEnd={handleTransformEnd}
            />
            {selectionBox ? (
              <Rect
                {...selectionBox}
                fill="rgba(37, 99, 235, 0.08)"
                stroke="#2563eb"
                strokeWidth={1}
                listening={false}
              />
            ) : null}
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
