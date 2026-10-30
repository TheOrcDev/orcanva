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
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { resizeDocument } from "@/lib/editor/document-ops";
import { selectDocument } from "@/lib/editor/store";

const ResizeForm = ({ onDone }: { onDone: () => void }) => {
  const id = useId();
  const store = useEditorStoreApi();
  const document = useEditor(selectDocument);
  const [width, setWidth] = useState(String(document.width));
  const [height, setHeight] = useState(String(document.height));
  const [scaleContent, setScaleContent] = useState(true);

  const parsedWidth = parseCanvasDimension(width);
  const parsedHeight = parseCanvasDimension(height);
  const isValid = parsedWidth !== null && parsedHeight !== null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (parsedWidth === null || parsedHeight === null) {
      return;
    }
    const state = store.getState();
    state.change((doc) =>
      resizeDocument(
        doc,
        { height: parsedHeight, width: parsedWidth },
        scaleContent
      )
    );
    state.zoomToFit();
    onDone();
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Resize canvas</DialogTitle>
        <DialogDescription>
          Undo with ⌘Z if the result isn&apos;t what you wanted.
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
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`${id}-scale`}>Scale content</FieldLabel>
            <FieldDescription>
              Stretch positions and sizes to the new canvas.
            </FieldDescription>
          </FieldContent>
          <Switch
            id={`${id}-scale`}
            checked={scaleContent}
            onCheckedChange={setScaleContent}
          />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={!isValid}>
          Resize
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
      <DialogContent className="sm:max-w-2xl">
        {open ? <ResizeForm onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
};
