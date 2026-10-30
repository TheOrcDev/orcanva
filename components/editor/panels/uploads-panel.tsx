"use client";

import { RiImageAddLine, RiUploadCloud2Line } from "@remixicon/react";
import Image from "next/image";
import { useRef } from "react";

import { useEditor } from "@/components/editor/editor-store-context";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useInsertElement } from "@/hooks/use-insert-element";
import { useUpload } from "@/hooks/use-upload";
import { createImageElement } from "@/lib/document/factories";
import { ASSET_DRAG_TYPE } from "@/lib/editor/drag-data";
import { UPLOAD_MIME_TYPES } from "@/lib/storage/keys";

const ACCEPT = Object.keys(UPLOAD_MIME_TYPES).join(",");

export const UploadsPanel = () => {
  const assets = useEditor((state) => state.assets);
  const uploading = useEditor((state) => state.uploadsInFlight);
  const upload = useUpload();
  const insert = useInsertElement();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <PanelSection title="Uploads">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        aria-label="Upload images"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // Reset so picking the same file again still fires onChange
          event.target.value = "";
          if (files.length > 0) {
            upload(files).catch(() => null);
          }
        }}
      />
      <Button onClick={() => inputRef.current?.click()}>
        {uploading > 0 ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <RiUploadCloud2Line data-icon="inline-start" />
        )}
        {uploading > 0 ? `Uploading ${uploading}…` : "Upload images"}
      </Button>
      <p className="text-muted-foreground text-xs">
        Or drop images onto the canvas, or paste with ⌘V. Drag a picture from
        here onto the canvas to place it.
      </p>

      {assets.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiImageAddLine />
            </EmptyMedia>
            <EmptyTitle>No uploads yet</EmptyTitle>
            <EmptyDescription>
              Images you upload are saved here for every design.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {assets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                draggable
                className="bg-muted hover:ring-ring focus-visible:ring-ring relative block aspect-square w-full overflow-hidden rounded-xl transition-shadow outline-none hover:ring-2 focus-visible:ring-2"
                aria-label={`Add ${asset.name} to the canvas`}
                title={asset.name}
                onClick={() =>
                  insert((page) => createImageElement(asset, page))
                }
                onDragStart={(event) => {
                  event.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
                  event.dataTransfer.effectAllowed = "copy";
                }}
              >
                <Image
                  src={asset.url}
                  alt=""
                  fill
                  unoptimized
                  sizes="128px"
                  className="pointer-events-none object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
};
