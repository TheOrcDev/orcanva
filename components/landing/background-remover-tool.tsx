"use client";

import { RiDownload2Line, RiRefreshLine } from "@remixicon/react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  ImageDropZone,
  useObjectUrl,
} from "@/components/landing/image-drop-zone";
import type { ImageDropZoneHandle } from "@/components/landing/image-drop-zone";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cutOutBackground } from "@/lib/background-removal/cut-out";
import { UPLOAD_MIME_TYPES } from "@/lib/storage/keys";

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

// What the box shows once there's a photo; null shows the picker
const preview = (state: State): ReactNode => {
  if (state.status === "working") {
    return (
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
    );
  }
  if (state.status === "done") {
    return (
      <div className="bento-checker size-full">
        {/* oxlint-disable-next-line nextjs/no-img-element -- a blob URL */}
        <img
          src={state.cutout}
          alt="Your upload with the background removed"
          className="size-full object-contain"
        />
      </div>
    );
  }
  return null;
};

// The editor's own background removal, on its own: the photo is read in this
// tab and the model runs on this device's GPU, so nothing is uploaded and
// nobody needs an account
export const BackgroundRemoverTool = ({
  editorHref,
}: {
  editorHref: string;
}) => {
  const dropZone = useRef<ImageDropZoneHandle>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const show = useObjectUrl();
  const busy = state.status === "working";

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

  return (
    <div className="flex flex-col gap-4">
      <ImageDropZone
        ref={dropZone}
        accept={ACCEPT}
        busy={busy}
        error={state.status === "error" ? state.message : undefined}
        formats="JPG, PNG, WebP or GIF"
        onImage={start}
      >
        {preview(state)}
      </ImageDropZone>
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
          <Button
            size="xl"
            variant="outline"
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
      ) : null}
    </div>
  );
};
