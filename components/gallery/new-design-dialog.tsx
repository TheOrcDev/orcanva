"use client";

import { RiAddLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";

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
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { createDesign } from "@/lib/actions/designs";
import {
  DEFAULT_PRESET,
  SIZE_PRESETS,
  findPresetBySize,
} from "@/lib/document/presets";
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from "@/lib/document/schema";
import { formatSize } from "@/lib/format";

const CUSTOM_PRESET = "custom";

const parseDimension = (value: string): number | null => {
  const parsed = Number(value);
  const isValid =
    Number.isInteger(parsed) &&
    parsed >= MIN_CANVAS_SIZE &&
    parsed <= MAX_CANVAS_SIZE;
  return isValid ? parsed : null;
};

export const NewDesignDialog = () => {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET.id);
  const [name, setName] = useState("");
  const [width, setWidth] = useState(String(DEFAULT_PRESET.width));
  const [height, setHeight] = useState(String(DEFAULT_PRESET.height));
  const [isPending, startTransition] = useTransition();

  const parsedWidth = parseDimension(width);
  const parsedHeight = parseDimension(height);
  const sizeError =
    parsedWidth === null || parsedHeight === null
      ? `Width and height must be whole numbers from ${MIN_CANVAS_SIZE} to ${MAX_CANVAS_SIZE}.`
      : null;

  const selectPreset = (value: string) => {
    setPresetId(value);
    const preset = SIZE_PRESETS.find((item) => item.id === value);
    if (preset) {
      setWidth(String(preset.width));
      setHeight(String(preset.height));
    }
  };

  const updateSize = (nextWidth: string, nextHeight: string) => {
    setWidth(nextWidth);
    setHeight(nextHeight);
    const match = findPresetBySize(Number(nextWidth), Number(nextHeight));
    setPresetId(match?.id ?? CUSTOM_PRESET);
  };

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
    <Dialog open={open} onOpenChange={setOpen}>
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

            <ScrollArea className="h-72">
              <RadioGroup
                className="mr-3 sm:grid-cols-2"
                value={presetId}
                onValueChange={(value) => selectPreset(String(value))}
              >
                {SIZE_PRESETS.map((preset) => (
                  <FieldLabel key={preset.id} htmlFor={`${id}-${preset.id}`}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{preset.label}</FieldTitle>
                        <FieldDescription>
                          {formatSize(preset.width, preset.height)} ·{" "}
                          {preset.description}
                        </FieldDescription>
                      </FieldContent>
                      <RadioGroupItem
                        value={preset.id}
                        id={`${id}-${preset.id}`}
                      />
                    </Field>
                  </FieldLabel>
                ))}
                <FieldLabel htmlFor={`${id}-${CUSTOM_PRESET}`}>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Custom</FieldTitle>
                      <FieldDescription>
                        Any size up to 4096 px
                      </FieldDescription>
                    </FieldContent>
                    <RadioGroupItem
                      value={CUSTOM_PRESET}
                      id={`${id}-${CUSTOM_PRESET}`}
                    />
                  </Field>
                </FieldLabel>
              </RadioGroup>
            </ScrollArea>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={parsedWidth === null || undefined}>
                <FieldLabel htmlFor={`${id}-width`}>Width (px)</FieldLabel>
                <Input
                  id={`${id}-width`}
                  type="number"
                  inputMode="numeric"
                  min={MIN_CANVAS_SIZE}
                  max={MAX_CANVAS_SIZE}
                  value={width}
                  aria-invalid={parsedWidth === null || undefined}
                  onChange={(event) => updateSize(event.target.value, height)}
                />
              </Field>
              <Field data-invalid={parsedHeight === null || undefined}>
                <FieldLabel htmlFor={`${id}-height`}>Height (px)</FieldLabel>
                <Input
                  id={`${id}-height`}
                  type="number"
                  inputMode="numeric"
                  min={MIN_CANVAS_SIZE}
                  max={MAX_CANVAS_SIZE}
                  value={height}
                  aria-invalid={parsedHeight === null || undefined}
                  onChange={(event) => updateSize(width, event.target.value)}
                />
              </Field>
            </div>
            {sizeError ? <FieldError>{sizeError}</FieldError> : null}
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={isPending || sizeError !== null}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Create design
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
