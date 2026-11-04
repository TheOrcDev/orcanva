"use client";

import { RiAspectRatioLine } from "@remixicon/react";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { SizePicker, parseCanvasDimension } from "@/components/size-picker";
import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import type { Size } from "@/lib/document/geometry";
import { findPresetBySize } from "@/lib/document/presets";
import { RESIZE_LAYOUTS } from "@/lib/editor/magic-resize";
import type { ResizeLayout } from "@/lib/editor/magic-resize";
import { resizeInPlace, undoResize } from "@/lib/editor/resize-design";
import { selectDocument } from "@/lib/editor/store";
import type { EditorStoreApi } from "@/lib/editor/store";
import { formatSize } from "@/lib/format";

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

// What a size is called in messages: its preset's name, or its pixels
const sizeLabel = (size: Size): string =>
  findPresetBySize(size.width, size.height)?.label ??
  `${formatSize(size.width, size.height)} px`;

// Says it's done, with an Undo that only steps back while the resize is
// still the latest change
const announceResize = (store: EditorStoreApi, step: object, size: Size) => {
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
    title: `Resized to ${sizeLabel(size)}`,
    type: "success",
  });
};

export const LayoutPicker = ({
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

const ResizeForm = ({ onDone }: { onDone: () => void }) => {
  const id = useId();
  const store = useEditorStoreApi();
  const document = useEditor(selectDocument);
  const [width, setWidth] = useState(String(document.width));
  const [height, setHeight] = useState(String(document.height));
  const [layout, setLayout] = useState<ResizeLayout>("magic");
  const [busy, setBusy] = useState(false);

  const parsedWidth = parseCanvasDimension(width);
  const parsedHeight = parseCanvasDimension(height);
  const isValid = parsedWidth !== null && parsedHeight !== null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (parsedWidth === null || parsedHeight === null) {
      return;
    }
    const size = { height: parsedHeight, width: parsedWidth };
    setBusy(true);
    const step = await resizeInPlace(store, size, layout);
    setBusy(false);
    onDone();
    if (step) {
      announceResize(store, step, size);
    }
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Magic Resize</DialogTitle>
        <DialogDescription>
          Pick a size, and how the design should fill it.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <SizePicker
          idPrefix={id}
          width={width}
          height={height}
          onSizeChange={(nextWidth, nextHeight) => {
            setWidth(nextWidth);
            setHeight(nextHeight);
          }}
        />
        <LayoutPicker
          idPrefix={`${id}-layout`}
          value={layout}
          onChange={setLayout}
        />
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={!isValid || busy}>
          {busy ? <Spinner data-icon="inline-start" /> : null}
          Resize this design
        </Button>
      </DialogFooter>
    </form>
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
