"use client";

import { RiCloseLine, RiImageAddLine } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import type { CompareThumbnail } from "@/components/youtube-preview/feed";
import type { Size } from "@/lib/document/geometry";
import { thumbnailFit } from "@/lib/youtube-preview/layout";

export const MAX_COMPARES = 3;

const EXTENSION = /\.[^.]+$/u;

export const readImageSize = async (file: File): Promise<Size> => {
  const bitmap = await createImageBitmap(file);
  const size = { height: bitmap.height, width: bitmap.width };
  bitmap.close();
  return size;
};

// A local image as a compare: shown from a blob URL, never uploaded
const fromFile = async (file: File): Promise<CompareThumbnail | null> => {
  try {
    const size = await readImageSize(file);
    const url = URL.createObjectURL(file);
    return {
      cover: thumbnailFit(size).exact,
      id: url,
      name: file.name.replace(EXTENSION, "") || "Image",
      url,
    };
  } catch {
    return null;
  }
};

// Up to three thumbnails to show beside the one being previewed. The blob
// URLs it makes are revoked when they're removed, and when it unmounts.
export const useCompares = () => {
  const [compares, setCompares] = useState<readonly CompareThumbnail[]>([]);
  const madeRef = useRef(new Set<string>());

  useEffect(() => {
    const made = madeRef.current;
    return () => {
      for (const url of made) {
        URL.revokeObjectURL(url);
      }
      made.clear();
    };
  }, []);

  const add = useCallback((items: readonly CompareThumbnail[]) => {
    setCompares((current) =>
      [
        ...current,
        ...items.filter(
          (item) => !current.some((existing) => existing.id === item.id)
        ),
      ].slice(0, MAX_COMPARES)
    );
  }, []);

  // Reads the files that fit; says how many couldn't be read
  const addFiles = useCallback(
    async (files: readonly File[]): Promise<number> => {
      const read = await Promise.all(files.map(fromFile));
      const items = read.filter((item) => item !== null);
      for (const item of items) {
        madeRef.current.add(item.url);
      }
      add(items);
      return read.length - items.length;
    },
    [add]
  );

  const remove = useCallback((id: string) => {
    setCompares((current) => current.filter((item) => item.id !== id));
    if (madeRef.current.delete(id)) {
      URL.revokeObjectURL(id);
    }
  }, []);

  return { add, addFiles, compares, remove };
};

// Lists the compares and adds more: images from this device, plus whatever
// `children` offers (the editor's own designs)
export const ComparePicker = ({
  children,
  compares,
  onAddFiles,
  onRemove,
}: {
  children?: ReactNode;
  compares: readonly CompareThumbnail[];
  onAddFiles: (files: readonly File[]) => Promise<number>;
  onRemove: (id: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const room = MAX_COMPARES - compares.length;

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.currentTarget.files ?? [])]
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, room);
    // Let the same files be picked again
    event.currentTarget.value = "";
    const failed = await onAddFiles(files);
    setError(failed > 0 ? "Some of those images couldn't be read." : null);
  };

  return (
    // A fieldset is as wide as its content unless told otherwise, and the
    // names below are cut to fit
    <FieldSet className="min-w-0">
      <FieldLegend variant="label">Compare with</FieldLegend>
      <FieldDescription>
        Up to {MAX_COMPARES} more thumbnails beside yours. Images from your
        device stay on it.
      </FieldDescription>
      {compares.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {compares.map((compare) => (
            <li key={compare.id} className="flex items-center gap-2">
              {/* oxlint-disable-next-line nextjs/no-img-element -- blob and storage URLs */}
              <img
                src={compare.url}
                alt=""
                className="bg-muted aspect-video w-16 shrink-0 rounded-md object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                {compare.name}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Stop comparing with ${compare.name}`}
                onClick={() => onRemove(compare.id)}
              >
                <RiCloseLine />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Choose images to compare with"
          onChange={handleFiles}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={room <= 0}
          onClick={() => inputRef.current?.click()}
        >
          <RiImageAddLine data-icon="inline-start" />
          Add images
        </Button>
        {children}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  );
};
