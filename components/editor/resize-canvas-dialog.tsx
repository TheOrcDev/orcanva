"use client";

import {
  RiAspectRatioLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
} from "@remixicon/react";
import Link from "next/link";
import { useId, useState } from "react";

import { usePageRenderer } from "@/components/editor/canvas/static-page";
import type { RenderOffscreen } from "@/components/editor/canvas/static-page";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { SizeChecklist, presetChoices } from "@/components/size-picker";
import type { SizeChoice } from "@/components/size-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useResizePreviews } from "@/hooks/use-resize-previews";
import { createResizedCopy } from "@/lib/actions/designs";
import { signInUrl } from "@/lib/auth/redirect";
import type { DesignDocument } from "@/lib/document/schema";
import { RESIZE_LAYOUTS } from "@/lib/editor/magic-resize";
import type { ResizeLayout } from "@/lib/editor/magic-resize";
import { stopIfOutdated } from "@/lib/editor/outdated";
import {
  CopyTooLargeError,
  copyName,
  resizeInPlace,
  resizedCopyOf,
  undoResize,
} from "@/lib/editor/resize-design";
import { selectDocument } from "@/lib/editor/store";
import type { EditorStoreApi } from "@/lib/editor/store";
import { THUMBNAIL_MAX_SIZE } from "@/lib/export/render-page";
import { uploadThumbnail } from "@/lib/export/thumbnailer";
import { waitForFonts } from "@/lib/fonts/loader";
import { formatSize } from "@/lib/format";
import { cn } from "@/lib/utils";

// Sizes one go can make
const MAX_SIZES = 8;
// As the editor's own gallery previews
const THUMBNAIL_QUALITY = 0.8;

const LAYOUTS: Record<ResizeLayout, { title: string; description: string }> = {
  keep: {
    description: "Only the page changes. Everything stays where it is.",
    title: "Keep positions",
  },
  magic: {
    description:
      "Lays the design out again: photos refit, text re-wraps and keeps its size, everything keeps its place.",
    title: "Magic",
  },
  stretch: {
    description: "Stretches positions and sizes to the new page.",
    title: "Stretch",
  },
};

const designPath = (designId: string) => `/design/${designId}`;

// Says it's done, with an Undo that only steps back while the resize is
// still the latest change
const announceResize = (store: EditorStoreApi, step: object, label: string) => {
  const id = toast.add({
    actionProps: {
      children: "Undo",
      onClick: () => {
        toast.close(id);
        if (!undoResize(store, step)) {
          toast.add({
            description: "Press ⌘Z to step back through the later ones.",
            title: "Other changes came after the resize",
          });
        }
      },
    },
    description: "⌘Z undoes it too.",
    timeout: 10_000,
    title: `Resized to ${label}`,
    type: "success",
  });
};

const LayoutPicker = ({
  value,
  onChange,
}: {
  value: ResizeLayout;
  onChange: (layout: ResizeLayout) => void;
}) => (
  <FieldSet>
    <FieldLegend variant="label">Layout</FieldLegend>
    <ToggleGroup
      variant="outline"
      value={[value]}
      onValueChange={(next) => {
        const [picked] = next;
        if (picked) {
          onChange(picked as ResizeLayout);
        }
      }}
    >
      {RESIZE_LAYOUTS.map((layout) => (
        <ToggleGroupItem key={layout} value={layout}>
          {LAYOUTS[layout].title}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
    <FieldDescription>{LAYOUTS[value].description}</FieldDescription>
  </FieldSet>
);

interface CopyResult {
  choice: SizeChoice;
  name: string;
  id: string | null;
  error: string | null;
}

type Phase =
  | { kind: "choose" }
  | { kind: "busy"; done: number; total: number }
  | { kind: "done"; results: CopyResult[] };

const copyError = (error: unknown): string =>
  error instanceof CopyTooLargeError
    ? error.message
    : "Couldn't save it. Check your connection and try again.";

const CopyResults = ({ results }: { results: readonly CopyResult[] }) => (
  <ItemGroup>
    {results.map((result) => (
      <Item key={result.choice.id} variant="outline" size="sm">
        {result.id ? null : (
          <ItemMedia variant="icon">
            <RiErrorWarningLine />
          </ItemMedia>
        )}
        <ItemContent>
          <ItemTitle>{result.name}</ItemTitle>
          <ItemDescription>
            {result.error ??
              `${formatSize(result.choice.width, result.choice.height)} px · private`}
          </ItemDescription>
        </ItemContent>
        {result.id ? (
          <ItemActions>
            <Link
              href={designPath(result.id)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Open
              <RiExternalLinkLine data-icon="inline-end" />
            </Link>
          </ItemActions>
        ) : null}
      </Item>
    ))}
  </ItemGroup>
);

// Gives a new copy its gallery preview at once, drawn off screen. A copy
// without one still gets one when it's first opened.
const thumbnailOf = async (
  render: RenderOffscreen,
  designId: string,
  document: DesignDocument
) => {
  try {
    const picture = await render(document, {
      format: "jpeg",
      pixelRatio: Math.min(
        1,
        THUMBNAIL_MAX_SIZE / Math.max(document.width, document.height)
      ),
      quality: THUMBNAIL_QUALITY,
    });
    await uploadThumbnail(designId, picture);
  } catch {
    // The copy is made; only its preview waits
  }
};

// The ticked sizes as they'd come out, drawn small off screen
const Previews = ({
  layout,
  sizes,
}: {
  layout: ResizeLayout;
  sizes: readonly SizeChoice[];
}) => {
  const urls = useResizePreviews(sizes, layout);
  return (
    <FieldSet>
      <FieldLegend variant="label">Preview</FieldLegend>
      {sizes.length === 0 ? (
        <FieldDescription>
          Tick a size to see how it comes out.
        </FieldDescription>
      ) : (
        <ul className="flex gap-3 overflow-x-auto pb-2">
          {sizes.map((size) => {
            const url = urls.get(size.id);
            return (
              <li key={size.id} className="flex shrink-0 flex-col gap-1.5">
                <div className="flex h-40 items-center justify-center">
                  {url ? (
                    // oxlint-disable-next-line nextjs/no-img-element -- a blob URL drawn in this tab
                    <img
                      src={url}
                      alt={`${size.label} preview`}
                      width={size.width}
                      height={size.height}
                      className="ring-border max-h-40 w-auto rounded-sm ring-1"
                    />
                  ) : (
                    <Skeleton
                      className={cn(
                        "h-40",
                        size.width >= size.height
                          ? "aspect-video"
                          : "aspect-[9/16]"
                      )}
                    />
                  )}
                </div>
                <span className="text-muted-foreground text-xs">
                  {size.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </FieldSet>
  );
};

const ResizeForm = ({ onDone }: { onDone: () => void }) => {
  const id = useId();
  const store = useEditorStoreApi();
  const document = useEditor(selectDocument);
  const designId = useEditor((state) => state.designId);
  const name = useEditor((state) => state.name);
  const signedIn = useEditor((state) => state.viewer !== null);
  const incomplete = useEditor((state) => state.skippedElementIds.length > 0);
  const [customs, setCustoms] = useState<SizeChoice[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [layout, setLayout] = useState<ResizeLayout>("magic");
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const render = usePageRenderer();

  const choices = [...presetChoices, ...customs];
  const sizes = ticked.flatMap((choiceId) => {
    const choice = choices.find((item) => item.id === choiceId);
    return choice ? [choice] : [];
  });
  const [only] = sizes;
  const busy = phase.kind === "busy";

  const resizeHere = async () => {
    if (!only || sizes.length !== 1) {
      return;
    }
    setPhase({ done: 0, kind: "busy", total: 1 });
    const step = await resizeInPlace(store, only, layout);
    onDone();
    if (step) {
      announceResize(store, step, only.label);
    }
  };

  const makeCopies = async () => {
    setPhase({ done: 0, kind: "busy", total: sizes.length });
    // Measured in a fallback font, text would wrap wrongly
    await waitForFonts(selectDocument(store.getState())).catch(() => null);
    const results: CopyResult[] = [];
    for (const [index, choice] of sizes.entries()) {
      setPhase({ done: index, kind: "busy", total: sizes.length });
      const copy = copyName(name, choice.label);
      try {
        const { document: laid, input } = resizedCopyOf(
          store,
          choice,
          layout,
          copy
        );
        // oxlint-disable-next-line no-await-in-loop -- one copy at a time, as actions run, with progress
        const { id: copyId } = await createResizedCopy(input);
        // oxlint-disable-next-line no-await-in-loop -- one page drawn at a time anyway
        await thumbnailOf(render, copyId, laid);
        results.push({ choice, error: null, id: copyId, name: copy });
      } catch (error) {
        if (stopIfOutdated(store, error)) {
          onDone();
          return;
        }
        results.push({ choice, error: copyError(error), id: null, name: copy });
      }
    }
    setPhase({ kind: "done", results });
  };

  if (phase.kind === "done") {
    const made = phase.results.filter((result) => result.id).length;
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {made === phase.results.length
              ? `${made === 1 ? "Copy" : "Copies"} made`
              : `${made} of ${phase.results.length} copies made`}
          </DialogTitle>
          <DialogDescription>
            Each is a private design of yours, in your designs. This one is
            unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
          <CopyResults results={phase.results} />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setPhase({ kind: "choose" })}
          >
            Make more
          </Button>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Magic Resize</DialogTitle>
        <DialogDescription>
          Resize this design, or make a copy at each size you tick.
        </DialogDescription>
      </DialogHeader>
      <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6">
        <FieldGroup>
          <SizeChecklist
            idPrefix={id}
            current={document}
            choices={choices}
            ticked={ticked}
            max={MAX_SIZES}
            onTickedChange={setTicked}
            onAddCustom={(choice) => {
              if (!choices.some((item) => item.id === choice.id)) {
                setCustoms((list) => [...list, choice]);
              }
              setTicked((list) => [
                ...list.filter((item) => item !== choice.id),
                choice.id,
              ]);
            }}
            onRemoveCustom={(choiceId) => {
              setCustoms((list) => list.filter((item) => item.id !== choiceId));
              setTicked((list) => list.filter((item) => item !== choiceId));
            }}
          />
          <LayoutPicker value={layout} onChange={setLayout} />
          {busy ? null : <Previews layout={layout} sizes={sizes} />}
        </FieldGroup>
        {incomplete ? (
          <p className="text-muted-foreground text-sm">
            Parts of this design were made with a newer Orcanva. Reload to copy
            or resize all of it.
          </p>
        ) : null}
      </div>
      <DialogFooter className="items-center">
        {busy ? (
          <output
            aria-live="polite"
            className="text-muted-foreground mr-auto flex items-center gap-2 text-sm"
          >
            <Spinner />
            {phase.total === 1
              ? "Laying it out…"
              : `Making ${phase.done + 1} of ${phase.total}…`}
          </output>
        ) : null}
        {signedIn || busy ? null : (
          <p className="text-muted-foreground mr-auto text-sm">
            <Link href={signInUrl(designPath(designId))} className="underline">
              Sign in to make copies
            </Link>
          </p>
        )}
        <Button
          variant="outline"
          disabled={sizes.length !== 1 || busy || incomplete}
          onClick={resizeHere}
        >
          Resize this design
        </Button>
        <Button
          disabled={sizes.length === 0 || busy || incomplete || !signedIn}
          onClick={makeCopies}
        >
          {sizes.length > 1
            ? `Copy & resize (${sizes.length})`
            : "Copy & resize"}
        </Button>
      </DialogFooter>
    </>
  );
};

export const ResizeCanvasDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <RiAspectRatioLine data-icon="inline-start" />
        Resize
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-3xl">
        {open ? <ResizeForm onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
};
