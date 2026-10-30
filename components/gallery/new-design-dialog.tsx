"use client";

import { RiAddLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";

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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { createDesign } from "@/lib/actions/designs";
import { DEFAULT_PRESET, findPresetBySize } from "@/lib/document/presets";

export const NewDesignDialog = () => {
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState("");
  const [width, setWidth] = useState(String(DEFAULT_PRESET.width));
  const [height, setHeight] = useState(String(DEFAULT_PRESET.height));
  // Private unless the owner opts in
  const [isPublic, setIsPublic] = useState(false);
  const [isPending, startTransition] = useTransition();

  const parsedWidth = parseCanvasDimension(width);
  const parsedHeight = parseCanvasDimension(height);
  const isValid = parsedWidth !== null && parsedHeight !== null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (parsedWidth === null || parsedHeight === null) {
      return;
    }
    const preset = findPresetBySize(parsedWidth, parsedHeight);
    const designName = name.trim() || preset?.label || "Untitled design";

    startTransition(async () => {
      try {
        const design = await createDesign({
          height: parsedHeight,
          name: designName,
          visibility: isPublic ? "public" : "private",
          width: parsedWidth,
        });
        router.push(`/design/${design.id}`);
      } catch {
        toast.add({
          description: "Check your connection and try again.",
          title: "Could not create design",
          type: "error",
        });
      }
    });
  };

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <RiAddLine data-icon="inline-start" />
        New design
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a design</DialogTitle>
            <DialogDescription>
              Pick a size. You can resize the canvas later.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
              <Input
                id={`${id}-name`}
                placeholder="Untitled design"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={`${id}-public`}>Public</FieldLabel>
                <FieldDescription>
                  Anyone can find it in the gallery and edit it with you, signed
                  in or not.
                </FieldDescription>
              </FieldContent>
              <Switch
                id={`${id}-public`}
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </Field>
            <SizePicker
              idPrefix={id}
              width={width}
              height={height}
              onSizeChange={(nextWidth, nextHeight) => {
                setWidth(nextWidth);
                setHeight(nextHeight);
              }}
            />
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !isValid}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Create design
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
