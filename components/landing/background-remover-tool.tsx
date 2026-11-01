"use client";

import {
  RiDownload2Line,
  RiImageAddLine,
  RiRefreshLine,
} from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cutOutBackground } from "@/lib/background-removal/cut-out";
import { UPLOAD_MIME_TYPES, isUploadMimeType } from "@/lib/storage/keys";
import { cn } from "@/lib/utils";

const ACCEPT = Object.keys(UPLOAD_MIME_TYPES).join(",");

const EXTENSION = /\.[^.]+$/u;

// The pictures are blob URLs, made when they're shown and revoked when the
// next one replaces them
type State =
  | { status: "idle" }
  | { status: "working"; original: string; progress: number | null }
  | { status: "done"; cutout: string; fileName: string }
  | { status: "error"; message: string };

// photo.jpg → photo-no-background.png
const cutoutName = (file: File) =>
  `${file.name.replace(EXTENSION, "") || "image"}-no-background.png`;

const firstImage = (files: FileList | null | undefined) =>
  [...(files ?? [])].find((file) => isUploadMimeType(file.type));

const statusText = (state: State) => {
  if (state.status === "done") {
    return "Done: the background is removed.";
  }
  if (state.status !== "working") {
    return "";
  }
  // The model downloads once (about 220 MB), then the browser keeps it
  return state.progress !== null && state.progress < 100
    ? `Downloading the AI model, ${Math.round(state.progress)}%`
    : "Removing the background…";
};

// The editor's own background removal, on its own: the photo is read in this
// tab and the model runs on this device's GPU, so nothing is uploaded and
// nobody needs an account
export const BackgroundRemoverTool = ({
  editorHref,
}: {
  editorHref: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  // The one blob URL alive at a time
  const shown = useRef<string | null>(null);
  const busy = state.status === "working";

  const show = (blob: Blob) => {
    if (shown.current) {
      URL.revokeObjectURL(shown.current);
    }
    shown.current = URL.createObjectURL(blob);
    return shown.current;
  };

  useEffect(
    () => () => {
      if (shown.current) {
        URL.revokeObjectURL(shown.current);
      }
    },
    []
  );

  const start = async (image: File) => {
    setState({ original: show(image), progress: null, status: "working" });
    try {
      const { png } = await cutOutBackground(image, (progress) =>
        setState((current) =>
          current.status === "working" ? { ...current, progress } : current
        )
      );
      setState({
        cutout: show(png),
        fileName: cutoutName(image),
        status: "done",
      });
    } catch (error) {
      setState({
        message:
          error instanceof Error ? error.message : "Something went wrong",
        status: "error",
      });
    }
  };

  const take = (files: FileList | null | undefined) => {
    const image = firstImage(files);
    if (image && !busy) {
      start(image);
    }
  };

  // ⌘V with an image on the clipboard, like the editor
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (firstImage(event.clipboardData?.files)) {
        event.preventDefault();
        take(event.clipboardData?.files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    take(event.target.files);
    // Picking the same file again should still start
    event.target.value = "";
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    take(event.dataTransfer.files);
  };

  const choose = () => inputRef.current?.click();

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Choose an image"
        onChange={onChange}
      />
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "bg-card ring-foreground/10 relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-3xl shadow-xl ring-1 transition-shadow sm:aspect-video",
          dragging && "ring-primary ring-2"
        )}
      >
        {state.status === "idle" || state.status === "error" ? (
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <RiImageAddLine
              aria-hidden
              className="text-muted-foreground size-10"
            />
            <Button size="xl" onClick={choose}>
              Choose an image
            </Button>
            <p className="text-muted-foreground text-sm">
              or drop one here, or paste it with ⌘V. JPG, PNG, WebP or GIF.
            </p>
            {state.status === "error" ? (
              <p role="alert" className="text-destructive max-w-md text-sm">
                {state.message}
              </p>
            ) : null}
          </div>
        ) : null}
        {state.status === "working" ? (
          <>
            {/* oxlint-disable-next-line nextjs/no-img-element -- a blob URL */}
            <img
              src={state.original}
              alt="Your upload, while its background is removed"
              className="size-full object-contain opacity-40"
            />
            <div className="bg-background/80 absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-4 text-sm backdrop-blur">
              <Spinner aria-hidden />
              <span>{statusText(state)}</span>
            </div>
          </>
        ) : null}
        {state.status === "done" ? (
          <div className="bento-checker size-full">
            {/* oxlint-disable-next-line nextjs/no-img-element -- a blob URL */}
            <img
              src={state.cutout}
              alt="Your upload with the background removed"
              className="size-full object-contain"
            />
          </div>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {statusText(state)}
      </p>
      {state.status === "done" ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href={state.cutout}
            download={state.fileName}
            className={buttonVariants({ size: "xl" })}
          >
            <RiDownload2Line data-icon="inline-start" />
            Download PNG
          </a>
          <Button size="xl" variant="outline" onClick={choose}>
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
      ) : null}
    </div>
  );
};
