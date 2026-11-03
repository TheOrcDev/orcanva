"use client";

import { RiDownload2Line, RiHdLine, RiRefreshLine } from "@remixicon/react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { BeforeAfter } from "@/components/landing/before-after";
import {
  ImageDropZone,
  useObjectUrl,
} from "@/components/landing/image-drop-zone";
import type { ImageDropZoneHandle } from "@/components/landing/image-drop-zone";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { runAiTask } from "@/lib/ai/client";
import type { AiProgress } from "@/lib/ai/client";
import { UPLOAD_MIME_TYPES, isUploadMimeType } from "@/lib/storage/keys";
import { factorLabel, upscaleOptions } from "@/lib/upscale/options";
import type { UpscaleOption } from "@/lib/upscale/options";

const ACCEPT = Object.keys(UPLOAD_MIME_TYPES).join(",");

const EXTENSION = /\.[^.]+$/u;

// The pictures are blob URLs, made when they're shown and revoked when the
// next one replaces them
type State =
  | { status: "idle" }
  | {
      status: "ready";
      file: File;
      original: string;
      options: UpscaleOption[];
    }
  | {
      status: "working";
      original: string;
      option: UpscaleOption;
      progress: AiProgress | null;
    }
  | {
      status: "done";
      file: File;
      original: string;
      options: UpscaleOption[];
      option: UpscaleOption;
      upscaled: string;
      fileName: string;
    }
  | { status: "error"; message: string };

const sizeLabel = ({ height, width }: UpscaleOption) => `${width} × ${height}`;

// photo.jpg → photo-4x.jpg, in the format it was saved in
const upscaledName = (file: File, option: UpscaleOption, type: string) => {
  const extension = isUploadMimeType(type) ? UPLOAD_MIME_TYPES[type] : "png";
  const factor = factorLabel(option.factor).replace("×", "x");
  return `${file.name.replace(EXTENSION, "") || "image"}-${factor}.${extension}`;
};

const statusText = (state: State) => {
  if (state.status === "done") {
    return `Done: upscaled to ${sizeLabel(state.option)}.`;
  }
  if (state.status !== "working") {
    return "";
  }
  const { progress } = state;
  // The model downloads once (about 2.4 MB), then the browser keeps it
  if (progress?.stage === "download" && progress.percent < 100) {
    return `Downloading the AI model, ${Math.round(progress.percent)}%`;
  }
  const done = progress?.stage === "work" ? Math.round(progress.percent) : 0;
  return `Upscaling to ${sizeLabel(state.option)}, ${done}%`;
};

// What the box shows once there's a photo; null shows the picker
const preview = (state: State): ReactNode => {
  if (state.status === "ready" || state.status === "working") {
    return (
      <>
        {/* oxlint-disable-next-line nextjs/no-img-element -- a blob URL */}
        <img
          src={state.original}
          alt="Your upload"
          className={
            state.status === "working"
              ? "size-full object-contain opacity-40"
              : "size-full object-contain"
          }
        />
        {state.status === "working" ? (
          <div className="bg-background/80 absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-4 text-sm backdrop-blur">
            <Spinner aria-hidden />
            <span>{statusText(state)}</span>
          </div>
        ) : null}
      </>
    );
  }
  if (state.status === "done") {
    return (
      <BeforeAfter
        before={state.original}
        beforeLabel="Your upload as it is"
        after={state.upscaled}
        afterLabel={`Your upload upscaled to ${sizeLabel(state.option)}`}
      />
    );
  }
  return null;
};

// The editor's own upscaler, on its own: the photo is read in this tab and
// the model runs on this device, so nothing is uploaded and nobody needs an
// account
export const ImageUpscalerTool = ({ editorHref }: { editorHref: string }) => {
  const dropZone = useRef<ImageDropZoneHandle>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const showOriginal = useObjectUrl();
  const showUpscaled = useObjectUrl();
  const busy = state.status === "working";

  const choose = async (file: File) => {
    try {
      // Decoded the way the model will read it, EXIF rotation included
      const bitmap = await createImageBitmap(file);
      const size = { height: bitmap.height, width: bitmap.width };
      bitmap.close();
      const options = upscaleOptions(size);
      if (options.length === 0) {
        setState({
          message: `This image is ${size.width} × ${size.height} already. Upscaling makes images up to 4096px on the long side.`,
          status: "error",
        });
        return;
      }
      setState({
        file,
        options,
        original: showOriginal(file),
        status: "ready",
      });
    } catch {
      setState({
        message: `${file.name} could not be read as an image`,
        status: "error",
      });
    }
  };

  const upscale = async (
    file: File,
    original: string,
    options: UpscaleOption[],
    option: UpscaleOption
  ) => {
    setState({ option, original, progress: null, status: "working" });
    try {
      const { blob } = await runAiTask(
        {
          height: option.height,
          image: file,
          kind: "upscale",
          width: option.width,
        },
        (progress) =>
          setState((current) =>
            current.status === "working" ? { ...current, progress } : current
          )
      );
      setState({
        file,
        fileName: upscaledName(file, option, blob.type),
        option,
        options,
        original,
        status: "done",
        upscaled: showUpscaled(blob),
      });
    } catch (error) {
      setState({
        message:
          error instanceof Error ? error.message : "Something went wrong",
        status: "error",
      });
    }
  };

  const choices =
    state.status === "ready" || state.status === "done" ? (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {state.options.map((option) => (
          <Button
            key={option.variant}
            size="xl"
            variant={
              state.status === "ready" && option === state.options.at(-1)
                ? "default"
                : "outline"
            }
            disabled={
              state.status === "done" && option.variant === state.option.variant
            }
            onClick={() =>
              upscale(state.file, state.original, state.options, option)
            }
          >
            <RiHdLine data-icon="inline-start" />
            Upscale {factorLabel(option.factor)}
            <span className="text-sm tabular-nums opacity-70">
              {sizeLabel(option)}
            </span>
          </Button>
        ))}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <ImageDropZone
        ref={dropZone}
        accept={ACCEPT}
        busy={busy}
        error={state.status === "error" ? state.message : undefined}
        formats="JPG, PNG, WebP or GIF"
        onImage={choose}
      >
        {preview(state)}
      </ImageDropZone>
      <p aria-live="polite" className="sr-only">
        {statusText(state)}
      </p>
      {state.status === "ready" ? choices : null}
      {state.status === "done" ? (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href={state.upscaled}
              download={state.fileName}
              className={buttonVariants({ size: "xl" })}
            >
              <RiDownload2Line data-icon="inline-start" />
              Download {sizeLabel(state.option)}
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
          {state.options.length > 1 ? choices : null}
        </>
      ) : null}
    </div>
  );
};
