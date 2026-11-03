"use client";

import { RiAddLine, RiCloseLine, RiImageAddLine } from "@remixicon/react";
import Image from "next/image";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { ColorPopover, DEFAULT_SWATCH_ROW } from "@/components/color-popover";
import { FontName, FontPicker } from "@/components/editor/panels/font-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { addBrandKitItem, removeBrandKitItem } from "@/lib/actions/brand-kit";
import {
  brandCountLabel,
  brandFonts,
  logoChoices,
  withBrandItem,
  withoutBrandItem,
} from "@/lib/brand-kit/kit";
import { isBrandKitFull } from "@/lib/brand-kit/schema";
import type { BrandKit, BrandKitItem } from "@/lib/brand-kit/schema";
import { loadRecentColors } from "@/lib/editor/recent-colors";
import type { EditorAsset } from "@/lib/editor/store";

type Change = (item: BrandKitItem, add: boolean, logo?: EditorAsset) => void;

const NEW_COLOR = "#ff3b30";

// A kit item with its remove button
const Chip = ({
  children,
  removeLabel,
  onRemove,
}: {
  children: ReactNode;
  removeLabel: string;
  onRemove: () => void;
}) => (
  <li className="bg-muted flex h-9 items-center gap-2 rounded-4xl pr-1 pl-3">
    {children}
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={removeLabel}
      title={removeLabel}
      onClick={onRemove}
    >
      <RiCloseLine />
    </Button>
  </li>
);

const KitCard = ({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count: string;
  children: ReactNode;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <CardAction>
        <Badge variant="secondary">{count}</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div className="flex flex-col gap-4">{children}</div>
    </CardContent>
  </Card>
);

const ColorsCard = ({ kit, change }: { kit: BrandKit; change: Change }) => {
  const [draft, setDraft] = useState(NEW_COLOR);
  const [recent, setRecent] = useState<string[]>([]);
  const full = isBrandKitFull(kit, "color");

  return (
    <KitCard
      title="Colors"
      description="Offered first in every color picker. The + there saves the color you're on."
      count={brandCountLabel(kit, "color")}
    >
      {kit.colors.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Brand colors">
          {kit.colors.map((color) => (
            <Chip
              key={color}
              removeLabel={`Remove ${color} from your brand kit`}
              onRemove={() => change({ kind: "color", value: color }, false)}
            >
              <span
                className="ring-foreground/15 size-5 rounded-full bg-(--swatch) ring-1"
                style={{ "--swatch": color }}
              />
              <span className="font-mono text-xs uppercase">{color}</span>
            </Chip>
          ))}
        </ul>
      ) : null}
      <div className="flex max-w-sm gap-2">
        <ColorPopover
          label="New brand color"
          value={draft}
          onChange={setDraft}
          onOpenChange={(open) => {
            if (open) {
              setRecent(loadRecentColors());
            }
          }}
          rows={[{ colors: recent, label: "Recent" }, DEFAULT_SWATCH_ROW]}
        />
        <Button
          variant="outline"
          disabled={full}
          onClick={() => change({ kind: "color", value: draft }, true)}
        >
          <RiAddLine data-icon="inline-start" />
          Add color
        </Button>
      </div>
      {full ? (
        <p className="text-muted-foreground text-xs">
          That&apos;s the most a kit holds: remove one to add another.
        </p>
      ) : null}
    </KitCard>
  );
};

const FontsCard = ({ kit, change }: { kit: BrandKit; change: Change }) => {
  const fonts = brandFonts(kit);
  const full = isBrandKitFull(kit, "font");

  return (
    <KitCard
      title="Fonts"
      description="Listed on top of the font picker as Brand fonts."
      count={brandCountLabel(kit, "font")}
    >
      {fonts.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Brand fonts">
          {fonts.map((font) => (
            <Chip
              key={font.id}
              removeLabel={`Remove ${font.family} from your brand kit`}
              onRemove={() => change({ kind: "font", value: font.id }, false)}
            >
              <FontName font={font} />
            </Chip>
          ))}
        </ul>
      ) : null}
      {full ? (
        <p className="text-muted-foreground text-xs">
          That&apos;s the most a kit holds: remove one to add another.
        </p>
      ) : (
        <div className="max-w-sm">
          <FontPicker
            value={null}
            label="Add a brand font"
            placeholder="Add a font"
            onChange={(font) => change({ kind: "font", value: font.id }, true)}
          />
        </div>
      )}
    </KitCard>
  );
};

const LogoTile = ({
  asset,
  label,
  onClick,
}: {
  asset: EditorAsset;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    className="bg-muted hover:ring-ring focus-visible:ring-ring relative block aspect-square w-full overflow-hidden rounded-xl transition-shadow outline-none hover:ring-2 focus-visible:ring-2"
    aria-label={label}
    title={asset.name}
    onClick={onClick}
  >
    <Image
      src={asset.url}
      alt=""
      fill
      unoptimized
      sizes="128px"
      className="pointer-events-none object-contain"
    />
  </button>
);

const LogosCard = ({
  kit,
  library,
  change,
}: {
  kit: BrandKit;
  library: readonly EditorAsset[];
  change: Change;
}) => {
  const [open, setOpen] = useState(false);
  const choices = logoChoices(library, kit);
  const full = isBrandKitFull(kit, "logo");

  return (
    <KitCard
      title="Logos"
      description="Picked from your uploads, and shown first in the editor's Uploads tab."
      count={brandCountLabel(kit, "logo")}
    >
      {kit.logos.length > 0 ? (
        <ul
          className="grid grid-cols-3 gap-3 sm:grid-cols-4"
          aria-label="Brand logos"
        >
          {kit.logos.map((logo) => (
            <li key={logo.id} className="relative">
              <div className="bg-muted relative aspect-square overflow-hidden rounded-xl">
                <Image
                  src={logo.url}
                  alt={logo.name}
                  fill
                  unoptimized
                  sizes="128px"
                  className="object-contain"
                />
              </div>
              <Button
                variant="secondary"
                size="icon-xs"
                className="absolute top-1.5 right-1.5"
                aria-label={`Remove ${logo.name} from your brand kit`}
                title="Remove from your brand kit"
                onClick={() => change({ kind: "logo", value: logo.id }, false)}
              >
                <RiCloseLine />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={<Button variant="outline" className="w-fit" />}
          disabled={full}
        >
          <RiImageAddLine data-icon="inline-start" />
          Add a logo
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a logo</DialogTitle>
            <DialogDescription>
              Pick one of your uploads. To add a new image, upload it in any
              design first.
            </DialogDescription>
          </DialogHeader>
          {choices.length > 0 ? (
            <ul className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-4">
              {choices.map((asset) => (
                <li key={asset.id}>
                  <LogoTile
                    asset={asset}
                    label={`Add ${asset.name} as a logo`}
                    onClick={() => {
                      change({ kind: "logo", value: asset.id }, true, asset);
                      setOpen(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <RiImageAddLine />
                </EmptyMedia>
                <EmptyTitle>No uploads to pick</EmptyTitle>
                <EmptyDescription>
                  {library.length > 0
                    ? "Every upload you have is a logo already."
                    : "Images you upload in a design show up here."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </DialogContent>
      </Dialog>
      {full ? (
        <p className="text-muted-foreground text-xs">
          That&apos;s the most a kit holds: remove one to add another.
        </p>
      ) : null}
    </KitCard>
  );
};

// The account's colours, fonts and logos. Each change shows at once, then
// takes the kit the Server Action returns, so it always ends up as stored.
export const BrandKitSettings = ({
  initialKit,
  library,
}: {
  initialKit: BrandKit;
  library: readonly EditorAsset[];
}) => {
  const [kit, setKit] = useState(initialKit);
  const [, startTransition] = useTransition();

  const change: Change = (item, add, logo) => {
    setKit((current) =>
      add ? withBrandItem(current, item, logo) : withoutBrandItem(current, item)
    );
    startTransition(async () => {
      try {
        const result = add
          ? await addBrandKitItem(item)
          : await removeBrandKitItem(item);
        setKit(result.kit);
        if (result.error) {
          toast.add({ title: result.error, type: "error" });
        }
      } catch {
        // Put it back as it was before this change
        setKit((current) =>
          add
            ? withoutBrandItem(current, item)
            : withBrandItem(current, item, logo)
        );
        toast.add({
          title: add
            ? "Couldn't add that to your brand kit"
            : "Couldn't remove that from your brand kit",
          type: "error",
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <ColorsCard kit={kit} change={change} />
      <FontsCard kit={kit} change={change} />
      <LogosCard kit={kit} library={library} change={change} />
    </div>
  );
};
