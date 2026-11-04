"use client";

import {
  RiAspectRatioLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
} from "@remixicon/react";
import Link from "next/link";
import { useId, useState } from "react";

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
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { createResizedCopy } from "@/lib/actions/designs";
import { signInUrl } from "@/lib/auth/redirect";
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
import { waitForFonts } from "@/lib/fonts/loader";
import { formatSize } from "@/lib/format";

// Sizes one go can make
const MAX_SIZES = 8;

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
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: ResizeLayout;
  onChange: (layout: ResizeLayout) => void;
}) => (
  <FieldSet>
    <FieldLegend variant="label">Layout</FieldLegend>
    <RadioGroup
      className="sm:grid-cols-3"
      value={value}
      onValueChange={(next) => onChange(next as ResizeLayout)}
    >
      {RESIZE_LAYOUTS.map((layout) => (
        <FieldLabel key={layout} htmlFor={`${idPrefix}-${layout}`}>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>{LAYOUTS[layout].title}</FieldTitle>
              <FieldDescription>{LAYOUTS[layout].description}</FieldDescription>
            </FieldContent>
            <RadioGroupItem value={layout} id={`${idPrefix}-${layout}`} />
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
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
        const input = resizedCopyOf(store, choice, layout, copy);
        // oxlint-disable-next-line no-await-in-loop -- one copy at a time, as actions run, with progress
        const { id: copyId } = await createResizedCopy(input);
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
      <div className="flex flex-col gap-6">
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
        <CopyResults results={phase.results} />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setPhase({ kind: "choose" })}
          >
            Make more
          </Button>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Magic Resize</DialogTitle>
        <DialogDescription>
          Resize this design, or make a copy at each size you tick.
        </DialogDescription>
      </DialogHeader>
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
        <LayoutPicker
          idPrefix={`${id}-layout`}
          value={layout}
          onChange={setLayout}
        />
      </FieldGroup>
      {busy ? (
        <output
          aria-live="polite"
          className="text-muted-foreground flex items-center gap-2 text-sm"
        >
          <Spinner />
          {phase.total === 1
            ? "Laying it out…"
            : `Making ${phase.done + 1} of ${phase.total}…`}
        </output>
      ) : null}
      {incomplete ? (
        <p className="text-muted-foreground text-sm">
          Parts of this design were made with a newer Orcanva. Reload to copy or
          resize all of it.
        </p>
      ) : null}
      <DialogFooter className="items-center">
        {signedIn ? null : (
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
    </div>
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        {open ? <ResizeForm onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
};
