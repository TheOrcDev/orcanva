"use client";

import {
  RiCheckLine,
  RiDownload2Line,
  RiRefreshLine,
  RiShareForwardLine,
} from "@remixicon/react";
import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  ImageDropZone,
  useObjectUrl,
} from "@/components/landing/image-drop-zone";
import type { ImageDropZoneHandle } from "@/components/landing/image-drop-zone";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { MetadataKind } from "@/lib/metadata-removal/metadata";
import { removeMetadata } from "@/lib/metadata-removal/remove-metadata";
import type { CleanFormat } from "@/lib/metadata-removal/remove-metadata";

// Any image: JPG, PNG and WebP are cleaned in place, the rest redrawn
const ACCEPT = "image/*";

const EXTENSION = /\.[^.]+$/u;

const LABELS: Record<MetadataKind, string> = {
  "ai-tag": "“AI generated” tag (IPTC)",
  camera: "Camera details (EXIF)",
  "content-credentials": "Content Credentials (C2PA)",
  location: "GPS location",
  other: "Other metadata",
  prompt: "Prompt and settings",
};

const FORMAT_NAMES: Record<CleanFormat, string> = {
  jpg: "JPG",
  png: "PNG",
  webp: "WebP",
};

// The pictures are blob URLs, made when they're shown and revoked when the
// next one replaces them
type State =
  | { status: "idle" }
  | { status: "working"; original: string }
  | {
      status: "done";
      clean: File;
      format: CleanFormat;
      found: MetadataKind[];
      redrawn: boolean;
      // The browser can hand the file to other apps (phones, mostly)
      shareable: boolean;
      url: string;
    }
  | { status: "error"; message: string };

type Done = Extract<State, { status: "done" }>;

// photo.png → photo-clean.png, named for the format the file really is
const cleanName = (file: File, format: CleanFormat) =>
  `${file.name.replace(EXTENSION, "") || "image"}-clean.${format}`;

const canShare = (file: File) => {
  try {
    return navigator.canShare?.({ files: [file] }) ?? false;
  } catch {
    return false;
  }
};

const statusText = (state: State) => {
  if (state.status === "working") {
    return "Reading the image…";
  }
  if (state.status !== "done") {
    return "";
  }
  if (state.redrawn) {
    return "Done: the image was redrawn, so only the picture is left.";
  }
  if (state.found.length === 0) {
    return "Done: the image had no metadata to remove.";
  }
  const removed = state.found.map((kind) => LABELS[kind]).join(", ");
  return `Done: removed ${removed}.`;
};

// What the box shows once there's an image; null shows the picker. While
// it's read, the original, which looks the same as the clean copy.
const preview = (state: State): ReactNode => {
  if (state.status === "working") {
    return (
      // oxlint-disable-next-line nextjs/no-img-element -- a blob URL
      <img
        src={state.original}
        alt="Your upload, while it's read"
        className="size-full object-contain"
      />
    );
  }
  if (state.status === "done") {
    return (
      // oxlint-disable-next-line nextjs/no-img-element -- a blob URL
      <img
        src={state.url}
        alt="Your upload, without its metadata"
        className="size-full object-contain"
      />
    );
  }
  return null;
};

const Summary = ({ state }: { state: Done }) => {
  const headingId = useId();
  if (state.redrawn) {
    return (
      <p className="text-muted-foreground max-w-xl text-sm text-pretty">
        This file isn&apos;t a JPG, PNG or WebP that could be cleaned in place,
        so it was redrawn from its pixels as a {FORMAT_NAMES[state.format]}.
        Nothing but the picture is left.
      </p>
    );
  }
  if (state.found.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        This image had no AI label or other metadata to remove.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <p id={headingId} className="text-muted-foreground text-sm">
        Removed from your image
      </p>
      <ul
        aria-labelledby={headingId}
        className="flex flex-wrap justify-center gap-2"
      >
        {state.found.map((kind) => (
          <li key={kind}>
            <Badge variant="secondary">
              <RiCheckLine data-icon="inline-start" />
              {LABELS[kind]}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
};

const share = async (file: File) => {
  try {
    await navigator.share({ files: [file] });
  } catch {
    // Closing the share sheet rejects too; there's nothing to tell
  }
};

// Removes an image's metadata in this tab: Content Credentials, AI tags,
// prompts, EXIF and GPS. Nothing is uploaded, so it's instant and needs no
// account.
export const MetadataRemoverTool = () => {
  const dropZone = useRef<ImageDropZoneHandle>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const show = useObjectUrl();
  const busy = state.status === "working";

  const start = async (image: File) => {
    setState({ original: show(image), status: "working" });
    try {
      const { blob, format, found, redrawn } = await removeMetadata(image);
      const clean = new File([blob], cleanName(image, format), {
        type: blob.type,
      });
      setState({
        clean,
        format,
        found,
        redrawn,
        shareable: canShare(clean),
        status: "done",
        url: show(clean),
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
    <div className="flex flex-col gap-6">
      <ImageDropZone
        ref={dropZone}
        accept={ACCEPT}
        busy={busy}
        error={state.status === "error" ? state.message : undefined}
        formats="JPG, PNG or WebP"
        onImage={start}
      >
        {preview(state)}
      </ImageDropZone>
      <p aria-live="polite" className="sr-only">
        {statusText(state)}
      </p>
      {state.status === "done" ? (
        <div className="flex flex-col items-center gap-6 text-center">
          <Summary state={state} />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href={state.url}
              download={state.clean.name}
              className={buttonVariants({ size: "xl" })}
            >
              <RiDownload2Line data-icon="inline-start" />
              Download {FORMAT_NAMES[state.format]}
            </a>
            {state.shareable ? (
              <Button
                size="xl"
                variant="outline"
                onClick={() => share(state.clean)}
              >
                <RiShareForwardLine data-icon="inline-start" />
                Share
              </Button>
            ) : null}
            <Button
              size="xl"
              variant="outline"
              onClick={() => dropZone.current?.choose()}
            >
              <RiRefreshLine data-icon="inline-start" />
              Another image
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
