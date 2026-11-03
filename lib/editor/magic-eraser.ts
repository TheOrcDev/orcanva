import { createStore } from "zustand/vanilla";

import type { AiProgress } from "@/lib/ai/client";
import { saveDerivedImage, swapPhoto } from "@/lib/editor/derived-images";
import { loadImage } from "@/lib/editor/image-cache";
import type { EditorAsset, EditorStoreApi } from "@/lib/editor/store";
import { applyPatch, fillMasked, strokeMask } from "@/lib/magic-eraser/erase";
import type { ErasePatch } from "@/lib/magic-eraser/erase";
import {
  EMPTY_SESSION,
  addErase,
  addStroke,
  appliedPatches,
  droppedPatches,
  pendingStrokes,
  redoStep,
  undoStep,
} from "@/lib/magic-eraser/session";
import type { EraseSession, Stroke } from "@/lib/magic-eraser/session";
import { encodeOptions, hasTransparency } from "@/lib/upscale/encode";

// The editor's erase mode for one image: the photo's own pixels, worked on
// in memory, and the strokes and erases of the session. Nothing is saved
// until Done, which uploads the result once as an "erased" copy of the
// photo and swaps it in as one undo step.

// Brush diameter on screen, in CSS pixels
export const MIN_BRUSH = 6;
export const MAX_BRUSH = 150;
const DEFAULT_BRUSH = 40;

export type EraseBusy = "loading" | "erasing" | "saving";

export interface EraseModeState {
  // The photo as erased so far, at its own size; null while it loads
  photo: ImageData | null;
  // A canvas of `photo` to draw, new after every change (filters cache by
  // what they're given)
  canvas: HTMLCanvasElement | null;
  session: EraseSession;
  brush: number;
  busy: EraseBusy | null;
  // The model's download, then the erase itself
  progress: AiProgress | null;
}

export interface EraseModeActions {
  setBrush: (size: number) => void;
  addStroke: (stroke: Stroke) => void;
  // Fills the strokes painted since the last erase; throws if the model fails
  erase: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  // Saves and swaps in the result, or just closes when nothing was erased;
  // throws if saving fails (the mode stays open)
  done: () => Promise<void>;
  // Closes the mode without saving
  cancel: () => void;
  // Starts reading the photo; the image counts as busy until the mode closes
  open: () => void;
  // The mode went away (the workspace unmounted it); stop listening
  dispose: () => void;
}

export type EraseMode = ReturnType<typeof createEraseMode>;

const toCanvas = (photo: ImageData): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = photo.width;
  canvas.height = photo.height;
  canvas.getContext("2d")?.putImageData(photo, 0, 0);
  return canvas;
};

// The photo's pixels, drawn from the same cached image the canvas shows
const readPixels = async (asset: EditorAsset): Promise<ImageData> => {
  const image = await loadImage(asset.url);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const context = new OffscreenCanvas(width, height).getContext("2d");
  if (!context) {
    throw new Error("Could not read the image");
  }
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, width, height);
};

const encode = (photo: ImageData): Promise<Blob> => {
  const canvas = new OffscreenCanvas(photo.width, photo.height);
  canvas.getContext("2d")?.putImageData(photo, 0, 0);
  return canvas.convertToBlob(encodeOptions(hasTransparency(photo.data)));
};

export const createEraseMode = (
  editor: EditorStoreApi,
  elementId: string,
  source: EditorAsset,
  onLoadError: (error: unknown) => void
) => {
  const patches = new Map<number, ErasePatch>();
  let nextPatch = 1;
  let closed = false;

  const close = () => {
    closed = true;
    patches.clear();
    editor.getState().setImageJob(elementId, null);
    if (editor.getState().eraseTargetId === elementId) {
      editor.getState().finishErase();
    }
  };

  const store = createStore<EraseModeState & EraseModeActions>()((set, get) => {
    // A new step may drop erases left to redo, and their pixels with them
    const commit = (session: EraseSession) => {
      for (const id of droppedPatches(get().session, session)) {
        patches.delete(id);
      }
      set({ session });
    };

    // Undo and redo put one side of an erase's patch back
    const move = (direction: "undo" | "redo") => {
      const { busy, photo, session } = get();
      if (busy || !photo) {
        return;
      }
      const { session: next, step } =
        direction === "undo" ? undoStep(session) : redoStep(session);
      const patch =
        step?.kind === "erase" ? patches.get(step.patch) : undefined;
      if (patch) {
        applyPatch(photo, patch, direction === "undo" ? "before" : "after");
        set({ canvas: toCanvas(photo), session: next });
      } else {
        set({ session: next });
      }
    };

    const load = async () => {
      try {
        const photo = await readPixels(source);
        if (!closed) {
          set({ busy: null, canvas: toCanvas(photo), photo });
        }
      } catch (error) {
        // Nothing to erase on: the photo can't be read
        if (!closed) {
          close();
          onLoadError(error);
        }
      }
    };

    return {
      addStroke: (stroke) => {
        if (!get().busy) {
          commit(addStroke(get().session, stroke));
        }
      },
      brush: DEFAULT_BRUSH,
      busy: "loading",
      cancel: () => {
        if (get().busy !== "saving") {
          close();
        }
      },
      canvas: null,
      dispose: () => {
        closed = true;
        patches.clear();
        editor.getState().setImageJob(elementId, null);
      },
      done: async () => {
        const { busy, photo, session } = get();
        if (busy) {
          return;
        }
        if (!photo || appliedPatches(session).length === 0) {
          close();
          return;
        }
        set({ busy: "saving", progress: null });
        try {
          const erased = await saveDerivedImage(
            editor,
            await encode(photo),
            source,
            "erased",
            " (erased)"
          );
          // Ready to draw before it shows, so the original never flashes
          // back in between
          await loadImage(erased.url).catch(() => null);
          swapPhoto(editor, elementId, source.id, erased);
          close();
        } catch (error) {
          set({ busy: null });
          throw error;
        }
      },
      erase: async () => {
        const { busy, photo, session } = get();
        const strokes = pendingStrokes(session);
        if (busy || !photo || strokes.length === 0) {
          return;
        }
        set({ busy: "erasing", progress: null });
        try {
          const patch = await fillMasked(
            photo,
            strokeMask(strokes, photo.width, photo.height),
            (progress) => {
              if (!closed) {
                set({ progress });
              }
            }
          );
          if (closed) {
            return;
          }
          if (!patch) {
            set({ busy: null });
            return;
          }
          const id = nextPatch;
          nextPatch += 1;
          patches.set(id, patch);
          commit(addErase(get().session, id));
          set({ busy: null, canvas: toCanvas(photo) });
        } catch (error) {
          set({ busy: null });
          throw error;
        }
      },
      open: () => {
        editor.getState().setImageJob(elementId, "erase");
        load().catch(() => null);
      },
      photo: null,
      progress: null,
      redo: () => move("redo"),
      session: EMPTY_SESSION,
      setBrush: (brush) =>
        set({ brush: Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, brush)) }),
      undo: () => move("undo"),
    };
  });

  return store;
};
