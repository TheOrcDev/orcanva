"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Group,
  Image as KonvaImage,
  Rect,
  Shape,
  Transformer,
} from "react-konva";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { useAssetImage } from "@/hooks/use-asset-image";
import { useFilteredImage } from "@/hooks/use-filtered-image";
import {
  containRect,
  coverRect,
  cropBetween,
  cropOrFull,
  isFullCrop,
  mirrorCrop,
  photoRect,
} from "@/lib/document/crop";
import type { Point, Rect as Box } from "@/lib/document/geometry";
import type { ImageElement } from "@/lib/document/schema";
import { updateElement } from "@/lib/editor/document-ops";

// Nodes of the crop tools: pressing anything else ends cropping
export const CROP_UI_NAME = "crop-ui";

const ACCENT = "#2563eb";
const DIM = "rgba(15, 23, 42, 0.55)";
const MIN_FRAME_SCREEN = 16;

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

const rotate = (point: Point, degrees: number): Point => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
};

export const isCropUi = (node: Konva.Node): boolean =>
  node.hasName(CROP_UI_NAME) || Boolean(node.findAncestor(`.${CROP_UI_NAME}`));

// Crop mode for one image. Everything is drawn in the image's own space at
// the moment cropping started (its position and rotation then): the frame
// is the part that shows and the photo is the whole picture behind it.
// Both come from the element on every render, and every gesture writes the
// element back, so undo, the panel and others' views all stay in step.
export const CropOverlay = ({
  element,
  zoom,
}: {
  element: ImageElement;
  zoom: number;
}) => {
  const store = useEditorStoreApi();
  const frameRef = useRef<Konva.Rect>(null);
  const photoRef = useRef<Konva.Group>(null);
  const photoImageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  // Where the image's space was when cropping started; fixed for the session
  // oxlint-disable-next-line react/hook-use-state
  const [space] = useState(() => ({
    origin: { x: element.x, y: element.y },
    rotation: element.rotation,
  }));
  const url = useEditor(
    (state) => state.assets.find((asset) => asset.id === element.assetId)?.url
  );
  const { image } = useAssetImage(url);

  const { flipX, flipY } = element;
  const offset = rotate(
    { x: element.x - space.origin.x, y: element.y - space.origin.y },
    -space.rotation
  );
  const frame: Box = {
    height: element.height,
    width: element.width,
    x: offset.x,
    y: offset.y,
  };
  // What shows, as the person sees it (a flipped photo's crop is mirrored)
  const visible = mirrorCrop(cropOrFull(element.crop), flipX, flipY);
  const photo = photoRect(frame, visible);
  // The whole photo, filtered like the image on the page
  useFilteredImage(photoImageRef, image, element.filter, photo, null);

  // Writes a frame and photo (in the image's start space) to the element
  const apply = (nextFrame: Box, nextPhoto: Box) => {
    const crop = mirrorCrop(cropBetween(nextFrame, nextPhoto), flipX, flipY);
    const position = rotate(nextFrame, space.rotation);
    store.getState().change((doc) =>
      updateElement(doc, element.id, {
        crop: isFullCrop(crop) ? null : crop,
        height: nextFrame.height,
        width: nextFrame.width,
        x: space.origin.x + position.x,
        y: space.origin.y + position.y,
      })
    );
  };

  useEffect(() => {
    const transformer = transformerRef.current;
    const frameNode = frameRef.current;
    if (transformer && frameNode) {
      transformer.nodes([frameNode]);
      transformer.getLayer()?.batchDraw();
    }
  }, []);

  // Enter keeps the crop and Escape puts the image back; the editor's own
  // shortcuts sit out while cropping
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      store.getState().finishCrop(event.key === "Enter");
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [store]);

  // Dragging the photo moves it under the frame, never leaving a gap
  const movePhoto = () => {
    const node = photoRef.current;
    if (!node) {
      return;
    }
    const moved = coverRect({ ...photo, x: node.x(), y: node.y() }, frame);
    node.position({ x: moved.x, y: moved.y });
    apply(frame, moved);
  };

  // The frame's handles crop: the photo stays, the frame stays on it
  const resizeFrame = () => {
    const node = frameRef.current;
    if (!node) {
      return;
    }
    const minimum = MIN_FRAME_SCREEN / zoom;
    const resized = containRect(
      {
        height: Math.max(minimum, node.height() * Math.abs(node.scaleY())),
        width: Math.max(minimum, node.width() * Math.abs(node.scaleX())),
        x: node.x(),
        y: node.y(),
      },
      photo
    );
    node.setAttrs({ ...resized, scaleX: 1, scaleY: 1 });
    apply(resized, photo);
  };

  return (
    <>
      <Group
        name={CROP_UI_NAME}
        x={space.origin.x}
        y={space.origin.y}
        rotation={space.rotation}
      >
        <Group
          ref={photoRef}
          x={photo.x}
          y={photo.y}
          draggable
          onDragMove={movePhoto}
          onDragEnd={movePhoto}
        >
          {image ? (
            <KonvaImage
              ref={photoImageRef}
              image={image}
              width={photo.width}
              height={photo.height}
              x={flipX ? photo.width : 0}
              y={flipY ? photo.height : 0}
              scaleX={flipX ? -1 : 1}
              scaleY={flipY ? -1 : 1}
            />
          ) : (
            <Rect width={photo.width} height={photo.height} fill="#e4e4e7" />
          )}
        </Group>
        {/* Dims the photo outside the frame */}
        <Shape
          listening={false}
          sceneFunc={(context) => {
            const native = context._context;
            native.beginPath();
            native.rect(photo.x, photo.y, photo.width, photo.height);
            native.rect(frame.x, frame.y, frame.width, frame.height);
            native.fillStyle = DIM;
            native.fill("evenodd");
          }}
        />
        <Rect
          ref={frameRef}
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          stroke="#ffffff"
          strokeWidth={1 / zoom}
          // Presses inside go to the photo; the handles still resize it
          listening={false}
          onTransform={resizeFrame}
          onTransformEnd={resizeFrame}
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
        enabledAnchors={ALL_ANCHORS}
        flipEnabled={false}
        ignoreStroke
        keepRatio={false}
        rotateEnabled={false}
      />
    </>
  );
};
