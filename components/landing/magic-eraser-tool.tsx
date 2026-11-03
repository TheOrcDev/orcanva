"use client";

import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiDownload2Line,
  RiEraserLine,
  RiRefreshLine,
} from "@remixicon/react";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { ImageDropZone } from "@/components/landing/image-drop-zone";
import type { ImageDropZoneHandle } from "@/components/landing/image-drop-zone";
import { Button, buttonVariants } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import type { AiProgress } from "@/lib/ai/client";
import type { Point } from "@/lib/document/geometry";
import {
  applyPatch,
  drawStrokes,
  fillMasked,
  strokeMask,
} from "@/lib/magic-eraser/erase";
import type { ErasePatch } from "@/lib/magic-eraser/erase";
import {
  EMPTY_SESSION,
  addErase,
  addStroke,
  canRedo,
  canUndo,
  droppedPatches,
  pendingStrokes,
  redoStep,
  undoStep,
} from "@/lib/magic-eraser/session";
import type { EraseSession, Stroke } from "@/lib/magic-eraser/session";
import { UPLOAD_MIME_TYPES } from "@/lib/storage/keys";
import { MAX_IMAGE_SIDE } from "@/lib/upload/prepare-image";
import { encodeOptions, hasTransparency } from "@/lib/upscale/encode";

const ACCEPT = Object.keys(UPLOAD_MIME_TYPES).join(",");

const EXTENSION = /\.[^.]+$/u;

// Brush diameter on screen, in CSS pixels
const MIN_BRUSH = 8;
const MAX_BRUSH = 120;
const DEFAULT_BRUSH = 40;

interface Photo {
  // Erases change these pixels in place, then the photo is set again as a
  // new object so it's redrawn
  pixels: ImageData;
  name: string;
}

// Reads a photo as pixels, no bigger than an upload may be
const readPhoto = async (file: File): Promise<ImageData> => {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const context = new OffscreenCanvas(width, height).getContext("2d");
    if (!context) {
      throw new Error("Could not read the image");
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    bitmap.close();
  }
};

// Where the photo shows inside a canvas laid out with object-contain
const shownBox = (canvas: HTMLCanvasElement, photo: ImageData) => {
  const box = canvas.getBoundingClientRect();
  const scale = Math.min(box.width / photo.width, box.height / photo.height);
  return {
    left: box.left + (box.width - photo.width * scale) / 2,
    scale,
    top: box.top + (box.height - photo.height * scale) / 2,
  };
};

const statusText = (busy: AiProgress | "starting" | null) => {
  if (busy === null) {
    return "";
  }
  // The model downloads once (about 37 MB), then the browser keeps it
  if (busy !== "starting" && busy.stage === "download" && busy.percent < 100) {
    return `Downloading the AI model, ${Math.round(busy.percent)}%`;
  }
  return "Erasing…";
};

// photo.jpg → photo-erased.jpg, or .png when it has transparency
const erasedName = (name: string, type: string) =>
  `${name.replace(EXTENSION, "") || "image"}-erased.${type === "image/png" ? "png" : "jpg"}`;

// The editor's magic eraser on its own: brush over something, press Erase,
// and the model fills it in, on this device; nothing is uploaded. Brushing
// happens on two plain canvases, the photo and the strokes over it.
export const MagicEraserTool = ({ editorHref }: { editorHref: string }) => {
  const dropZone = useRef<ImageDropZoneHandle>(null);
  const photoCanvas = useRef<HTMLCanvasElement>(null);
  const strokeCanvas = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [session, setSession] = useState<EraseSession>(EMPTY_SESSION);
  const patches = useRef(new Map<number, ErasePatch>());
  const nextPatch = useRef(1);
  const painting = useRef<Stroke | null>(null);
  const [brush, setBrush] = useState(DEFAULT_BRUSH);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [busy, setBusy] = useState<AiProgress | "starting" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const brushLabel = useId();
  const pending = pendingStrokes(session);

  useEffect(() => {
    const canvas = photoCanvas.current;
    if (!(canvas && photo)) {
      return;
    }
    canvas.width = photo.pixels.width;
    canvas.height = photo.pixels.height;
    canvas.getContext("2d")?.putImageData(photo.pixels, 0, 0);
  }, [photo]);

  // The strokes waiting for Erase, drawn solid on a half-see-through canvas
  // so overlaps don't darken
  useEffect(() => {
    const canvas = strokeCanvas.current;
    if (!(canvas && photo)) {
      return;
    }
    canvas.width = photo.pixels.width;
    canvas.height = photo.pixels.height;
    const context = canvas.getContext("2d");
    if (context) {
      context.strokeStyle = getComputedStyle(canvas).color;
      drawStrokes(context, pendingStrokes(session));
    }
  }, [photo, session]);

  const commit = (next: EraseSession) => {
    for (const id of droppedPatches(session, next)) {
      patches.current.delete(id);
    }
    setSession(next);
  };

  // The pixels changed in place: show them
  const redraw = () => setPhoto((current) => current && { ...current });

  const choose = async (file: File) => {
    setError(null);
    try {
      const pixels = await readPhoto(file);
      patches.current.clear();
      setSession(EMPTY_SESSION);
      setPhoto({ name: file.name, pixels });
    } catch {
      setError(`${file.name} could not be read as an image`);
    }
  };

  const toPhoto = (event: PointerEvent<HTMLCanvasElement>): Point | null => {
    if (!photo) {
      return null;
    }
    const { left, scale, top } = shownBox(event.currentTarget, photo.pixels);
    return {
      x: (event.clientX - left) / scale,
      y: (event.clientY - top) / scale,
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = toPhoto(event);
    if (!(point && photo) || busy) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const { scale } = shownBox(event.currentTarget, photo.pixels);
    painting.current = { points: [point], radius: brush / 2 / scale };
    const context = event.currentTarget.getContext("2d");
    if (context) {
      context.strokeStyle = getComputedStyle(event.currentTarget).color;
      drawStrokes(context, [painting.current]);
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setPointer({ x: event.clientX - box.left, y: event.clientY - box.top });
    const stroke = painting.current;
    const point = toPhoto(event);
    if (!(stroke && point)) {
      return;
    }
    const last = stroke.points.at(-1) ?? point;
    painting.current = { ...stroke, points: [...stroke.points, point] };
    // Just the new segment; the effect redraws everything on release
    const context = event.currentTarget.getContext("2d");
    if (context) {
      drawStrokes(context, [{ points: [last, point], radius: stroke.radius }]);
    }
  };

  const onPointerUp = () => {
    const stroke = painting.current;
    painting.current = null;
    if (stroke) {
      commit(addStroke(session, stroke));
    }
  };

  const erase = async () => {
    if (!photo || busy || pending.length === 0) {
      return;
    }
    setBusy("starting");
    setError(null);
    try {
      const mask = strokeMask(pending, photo.pixels.width, photo.pixels.height);
      const patch = await fillMasked(photo.pixels, mask, setBusy);
      if (patch) {
        const id = nextPatch.current;
        nextPatch.current += 1;
        patches.current.set(id, patch);
        commit(addErase(session, id));
        redraw();
      }
      setBusy(null);
    } catch (error_) {
      setBusy(null);
      setError(
        error_ instanceof Error ? error_.message : "Something went wrong"
      );
    }
  };

  const step = (direction: "undo" | "redo") => {
    if (!photo || busy) {
      return;
    }
    const { session: next, step: moved } =
      direction === "undo" ? undoStep(session) : redoStep(session);
    const patch =
      moved?.kind === "erase" ? patches.current.get(moved.patch) : undefined;
    if (patch) {
      applyPatch(
        photo.pixels,
        patch,
        direction === "undo" ? "before" : "after"
      );
      redraw();
    }
    setSession(next);
  };

  const download = async () => {
    if (!photo) {
      return;
    }
    const { height, width } = photo.pixels;
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d")?.putImageData(photo.pixels, 0, 0);
    const blob = await canvas.convertToBlob(
      encodeOptions(hasTransparency(photo.pixels.data))
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = erasedName(photo.name, blob.type);
    link.click();
    // Give the download a moment to start before letting the file go
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      step(event.shiftKey ? "redo" : "undo");
    } else if (event.key === "Enter") {
      event.preventDefault();
      erase().catch(() => null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ImageDropZone
        ref={dropZone}
        accept={ACCEPT}
        busy={busy !== null}
        error={photo ? undefined : (error ?? undefined)}
        formats="JPG, PNG, WebP or GIF"
        onImage={choose}
      >
        {photo ? (
          // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- the keys work while focus is on the canvas inside
          <div className="relative size-full" onKeyDown={onKeyDown}>
            <canvas
              ref={photoCanvas}
              aria-hidden
              className="bento-checker absolute inset-0 size-full object-contain"
            />
            <canvas
              ref={strokeCanvas}
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focus lets ⌘Z and Enter work here
              tabIndex={0}
              aria-label="Your upload. Paint over what to remove, then press Erase or Enter."
              className="text-primary absolute inset-0 size-full cursor-none touch-none object-contain opacity-50 outline-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={() => setPointer(null)}
            />
            {pointer && !busy ? (
              <div
                aria-hidden
                className="border-background pointer-events-none absolute top-(--y) left-(--x) size-(--size) -translate-1/2 rounded-full border-2 ring-1 ring-black/40"
                style={{
                  "--size": `${brush}px`,
                  "--x": `${pointer.x}px`,
                  "--y": `${pointer.y}px`,
                }}
              />
            ) : null}
            {busy ? (
              <div className="bg-background/80 absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-4 text-sm backdrop-blur">
                <Spinner aria-hidden />
                <span>{statusText(busy)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </ImageDropZone>
      <p aria-live="polite" className="sr-only">
        {statusText(busy)}
      </p>
      {photo ? (
        <>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
            <div className="flex w-56 items-center gap-3">
              <span id={brushLabel} className="text-sm font-medium">
                Brush
              </span>
              <Slider
                aria-labelledby={brushLabel}
                value={[brush]}
                min={MIN_BRUSH}
                max={MAX_BRUSH}
                onValueChange={(value) =>
                  setBrush(
                    typeof value === "number" ? value : (value[0] ?? brush)
                  )
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon-lg"
                variant="outline"
                aria-label="Undo"
                disabled={!canUndo(session) || busy !== null}
                onClick={() => step("undo")}
              >
                <RiArrowGoBackLine />
              </Button>
              <Button
                size="icon-lg"
                variant="outline"
                aria-label="Redo"
                disabled={!canRedo(session) || busy !== null}
                onClick={() => step("redo")}
              >
                <RiArrowGoForwardLine />
              </Button>
              <Button
                size="xl"
                disabled={pending.length === 0 || busy !== null}
                onClick={erase}
              >
                {busy ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RiEraserLine data-icon="inline-start" />
                )}
                Erase
              </Button>
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-center text-sm">
              {error}
            </p>
          ) : null}
          <p className="text-muted-foreground text-center text-sm">
            Paint over what to remove, then press Erase. Keep brushing and
            erasing until it&apos;s gone.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              size="xl"
              variant="outline"
              disabled={busy !== null}
              onClick={download}
            >
              <RiDownload2Line data-icon="inline-start" />
              Download
            </Button>
            <Button
              size="xl"
              variant="outline"
              disabled={busy !== null}
              onClick={() => dropZone.current?.choose()}
            >
              <RiRefreshLine data-icon="inline-start" />
              Another image
            </Button>
            <a
              href={editorHref}
              className={buttonVariants({ size: "xl", variant: "ghost" })}
            >
              Open the editor
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
};
