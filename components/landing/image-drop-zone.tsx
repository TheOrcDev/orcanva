"use client";

import { RiImageAddLine } from "@remixicon/react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, DragEvent, ReactNode, Ref } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageDropZoneHandle {
  // Opens the file picker, for an "Another image" button beside the box
  choose: () => void;
}

// Whether a file is one of the types in an `accept` list like
// "image/png,image/jpeg" or "image/*"
const isAccepted = (file: File, accept: string) =>
  accept
    .split(",")
    .some((type) =>
      type.endsWith("/*")
        ? file.type.startsWith(type.slice(0, -1))
        : file.type === type
    );

const firstImage = (files: FileList | null | undefined, accept: string) =>
  [...(files ?? [])].find((file) => isAccepted(file, accept));

// A blob URL for each picture a tool shows, one alive at a time: showing the
// next revokes the last, and leaving the page revokes it too
export const useObjectUrl = () => {
  const shown = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (shown.current) {
        URL.revokeObjectURL(shown.current);
      }
    },
    []
  );

  return useCallback((blob: Blob) => {
    if (shown.current) {
      URL.revokeObjectURL(shown.current);
    }
    shown.current = URL.createObjectURL(blob);
    return shown.current;
  }, []);
};

// The box a landing tool takes its image in: choose one, drop one on it or
// paste one with ⌘V. It shows `children` once there's an image (pass null
// before), and the picker until then.
export const ImageDropZone = ({
  accept,
  busy = false,
  children,
  error,
  formats,
  onImage,
  ref,
}: {
  accept: string;
  // Ignores new images while the last one is still being worked on
  busy?: boolean;
  children: ReactNode;
  error?: string;
  // Named under the button: "JPG, PNG, WebP or GIF"
  formats: string;
  onImage: (image: File) => void;
  ref?: Ref<ImageDropZoneHandle>;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const choose = () => inputRef.current?.click();

  useImperativeHandle(
    ref,
    () => ({ choose: () => inputRef.current?.click() }),
    []
  );

  const take = (files: FileList | null | undefined) => {
    const image = firstImage(files, accept);
    if (image && !busy) {
      onImage(image);
    }
  };

  // ⌘V with an image on the clipboard, like the editor
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (firstImage(event.clipboardData?.files, accept)) {
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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
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
        {children ?? (
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <RiImageAddLine
              aria-hidden
              className="text-muted-foreground size-10"
            />
            <Button size="xl" onClick={choose}>
              Choose an image
            </Button>
            <p className="text-muted-foreground text-sm">
              or drop one here, or paste it with ⌘V. {formats}.
            </p>
            {error ? (
              <p role="alert" className="text-destructive max-w-md text-sm">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
};
