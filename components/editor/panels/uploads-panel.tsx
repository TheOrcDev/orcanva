"use client";

import {
  RiImageAddLine,
  RiStarFill,
  RiStarLine,
  RiUploadCloud2Line,
} from "@remixicon/react";
import Image from "next/image";
import { useMemo, useRef } from "react";

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
import { useBrandKitChange } from "@/hooks/use-brand-kit";
import { useInsertElement } from "@/hooks/use-insert-element";
import { useUpload } from "@/hooks/use-upload";
import { isBrandKitFull } from "@/lib/brand-kit/schema";
import { createImageElement } from "@/lib/document/factories";
import { ASSET_DRAG_TYPE } from "@/lib/editor/drag-data";
import type { EditorAsset } from "@/lib/editor/store";
import { UPLOAD_MIME_TYPES } from "@/lib/storage/keys";

const ACCEPT = Object.keys(UPLOAD_MIME_TYPES).join(",");

// Whether a tile's star puts it in the brand kit or takes it out; missing
// for guests, who have no kit
interface LogoStar {
  starred: boolean;
  full: boolean;
  onToggle: () => void;
}

// A picture to click or drag onto the canvas. The star sits beside the
// tile's button, not in it, so no button nests in another.
const AssetTile = ({
  asset,
  star,
}: {
  asset: EditorAsset;
  star?: LogoStar;
}) => {
  const insert = useInsertElement();
  let starLabel = `Add ${asset.name} to your brand logos`;
  if (star?.starred) {
    starLabel = `Remove ${asset.name} from your brand logos`;
  } else if (star?.full) {
    starLabel = "Your brand kit is full";
  }
  const StarIcon = star?.starred ? RiStarFill : RiStarLine;

  return (
    <li className="relative">
      <button
        type="button"
        draggable
        className="bg-muted hover:ring-ring focus-visible:ring-ring relative block aspect-square w-full overflow-hidden rounded-xl transition-shadow outline-none hover:ring-2 focus-visible:ring-2"
        aria-label={`Add ${asset.name} to the canvas`}
        title={asset.name}
        onClick={() => insert((page) => createImageElement(asset, page))}
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
      {star ? (
        <Button
          variant="secondary"
          size="icon-xs"
          className="absolute top-1.5 right-1.5"
          aria-label={starLabel}
          aria-pressed={star.starred}
          title={starLabel}
          disabled={star.full && !star.starred}
          onClick={() => star.onToggle()}
        >
          <StarIcon />
        </Button>
      ) : null}
    </li>
  );
};

export const UploadsPanel = () => {
  const allAssets = useEditor((state) => state.assets);
  const libraryIds = useEditor((state) => state.libraryIds);
  const signedIn = useEditor((state) => state.viewer !== null);
  const brandKit = useEditor((state) => state.brandKit);
  const changeBrandKit = useBrandKitChange();
  // Only the viewer's own uploads, not what others put in the design
  const assets = useMemo(() => {
    const byId = new Map(allAssets.map((asset) => [asset.id, asset]));
    return libraryIds.flatMap((id) => byId.get(id) ?? []);
  }, [allAssets, libraryIds]);
  const logoIds = useMemo(
    () => new Set(brandKit?.logos.map((logo) => logo.id)),
    [brandKit]
  );
  const uploading = useEditor((state) => state.uploadsInFlight);
  const upload = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const starFor = (asset: EditorAsset): LogoStar | undefined => {
    if (!brandKit) {
      return;
    }
    const starred = logoIds.has(asset.id);
    return {
      full: isBrandKitFull(brandKit, "logo"),
      onToggle: () => {
        changeBrandKit(
          { kind: "logo", value: asset.id },
          !starred,
          asset
        ).catch(() => null);
      },
      starred,
    };
  };

  return (
    <>
      {brandKit && brandKit.logos.length > 0 ? (
        <PanelSection title="Brand logos">
          <ul className="grid grid-cols-2 gap-2" aria-label="Brand logos">
            {brandKit.logos.map((logo) => (
              <AssetTile key={logo.id} asset={logo} star={starFor(logo)} />
            ))}
          </ul>
        </PanelSection>
      ) : null}
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
          {brandKit ? " Star one to keep it with your brand logos." : null}
        </p>

        {assets.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RiImageAddLine />
              </EmptyMedia>
              <EmptyTitle>No uploads yet</EmptyTitle>
              <EmptyDescription>
                {signedIn
                  ? "Images you upload are saved here for every design."
                  : "Sign in to keep the images you upload for every design."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-2" aria-label="Uploads">
            {assets.map((asset) => (
              <AssetTile key={asset.id} asset={asset} star={starFor(asset)} />
            ))}
          </ul>
        )}
      </PanelSection>
    </>
  );
};
