"use client";

import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Size } from "@/lib/document/geometry";
import { SIZE_PRESETS, findPresetBySize } from "@/lib/document/presets";
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from "@/lib/document/schema";
import { formatSize } from "@/lib/format";

const CUSTOM_PRESET = "custom";

export const parseCanvasDimension = (value: string): number | null => {
  const parsed = Number(value);
  const isValid =
    Number.isInteger(parsed) &&
    parsed >= MIN_CANVAS_SIZE &&
    parsed <= MAX_CANVAS_SIZE;
  return isValid ? parsed : null;
};

export const SIZE_ERROR = `Width and height must be whole numbers from ${MIN_CANVAS_SIZE} to ${MAX_CANVAS_SIZE}.`;

export interface SizePickerProps {
  idPrefix: string;
  width: string;
  height: string;
  onSizeChange: (width: string, height: string) => void;
}

// Preset choice cards plus custom width/height; parents own the values
export const SizePicker = ({
  idPrefix,
  width,
  height,
  onSizeChange,
}: SizePickerProps) => {
  const [presetId, setPresetId] = useState<string>(
    () => findPresetBySize(Number(width), Number(height))?.id ?? CUSTOM_PRESET
  );
  const widthInvalid = parseCanvasDimension(width) === null;
  const heightInvalid = parseCanvasDimension(height) === null;

  const selectPreset = (value: string) => {
    setPresetId(value);
    const preset = SIZE_PRESETS.find((item) => item.id === value);
    if (preset) {
      onSizeChange(String(preset.width), String(preset.height));
    }
  };

  const updateSize = (nextWidth: string, nextHeight: string) => {
    onSizeChange(nextWidth, nextHeight);
    const match = findPresetBySize(Number(nextWidth), Number(nextHeight));
    setPresetId(match?.id ?? CUSTOM_PRESET);
  };

  return (
    <>
      <ScrollArea className="h-64">
        <RadioGroup
          className="mr-3 sm:grid-cols-2"
          value={presetId}
          onValueChange={(value) => selectPreset(String(value))}
        >
          {SIZE_PRESETS.map((preset) => (
            <FieldLabel key={preset.id} htmlFor={`${idPrefix}-${preset.id}`}>
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
                  id={`${idPrefix}-${preset.id}`}
                />
              </Field>
            </FieldLabel>
          ))}
          <FieldLabel htmlFor={`${idPrefix}-${CUSTOM_PRESET}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>Custom</FieldTitle>
                <FieldDescription>
                  Any size up to {MAX_CANVAS_SIZE} px
                </FieldDescription>
              </FieldContent>
              <RadioGroupItem
                value={CUSTOM_PRESET}
                id={`${idPrefix}-${CUSTOM_PRESET}`}
              />
            </Field>
          </FieldLabel>
        </RadioGroup>
      </ScrollArea>

      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={widthInvalid || undefined}>
          <FieldLabel htmlFor={`${idPrefix}-width`}>Width (px)</FieldLabel>
          <Input
            id={`${idPrefix}-width`}
            type="number"
            inputMode="numeric"
            min={MIN_CANVAS_SIZE}
            max={MAX_CANVAS_SIZE}
            value={width}
            aria-invalid={widthInvalid || undefined}
            onChange={(event) => updateSize(event.target.value, height)}
          />
        </Field>
        <Field data-invalid={heightInvalid || undefined}>
          <FieldLabel htmlFor={`${idPrefix}-height`}>Height (px)</FieldLabel>
          <Input
            id={`${idPrefix}-height`}
            type="number"
            inputMode="numeric"
            min={MIN_CANVAS_SIZE}
            max={MAX_CANVAS_SIZE}
            value={height}
            aria-invalid={heightInvalid || undefined}
            onChange={(event) => updateSize(width, event.target.value)}
          />
        </Field>
      </div>
      {widthInvalid || heightInvalid ? (
        <FieldError>{SIZE_ERROR}</FieldError>
      ) : null}
    </>
  );
};

// One size the checklist offers: a preset, or a custom size someone added
export interface SizeChoice extends Size {
  id: string;
  label: string;
  description: string;
}

export const presetChoices: readonly SizeChoice[] = SIZE_PRESETS.map(
  (preset) => ({
    description: preset.description,
    height: preset.height,
    id: preset.id,
    label: preset.label,
    width: preset.width,
  })
);

// A custom size, unless a preset has it already
export const customChoice = (size: Size): SizeChoice => {
  const preset = presetChoices.find(
    (choice) => choice.width === size.width && choice.height === size.height
  );
  return (
    preset ?? {
      description: "Custom size",
      height: size.height,
      id: `custom-${size.width}x${size.height}`,
      label: `${size.width} × ${size.height}`,
      width: size.width,
    }
  );
};

export interface SizeChecklistProps {
  idPrefix: string;
  // The page's own size, marked in the list
  current: Size;
  // Presets, then custom sizes
  choices: readonly SizeChoice[];
  ticked: readonly string[];
  onTickedChange: (ticked: string[]) => void;
  onAddCustom: (choice: SizeChoice) => void;
  onRemoveCustom: (id: string) => void;
  max: number;
}

// Any number of sizes, up to `max`: the presets, plus custom sizes added
// below them
export const SizeChecklist = ({
  choices,
  current,
  idPrefix,
  max,
  onAddCustom,
  onRemoveCustom,
  onTickedChange,
  ticked,
}: SizeChecklistProps) => {
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const parsedWidth = parseCanvasDimension(width);
  const parsedHeight = parseCanvasDimension(height);
  const typed = width !== "" || height !== "";
  const invalid = typed && (parsedWidth === null || parsedHeight === null);
  const full = ticked.length >= max;

  const toggle = (id: string, checked: boolean) =>
    onTickedChange(
      checked
        ? [...ticked.filter((item) => item !== id), id]
        : ticked.filter((item) => item !== id)
    );

  const addCustom = () => {
    if (parsedWidth === null || parsedHeight === null || full) {
      return;
    }
    onAddCustom(customChoice({ height: parsedHeight, width: parsedWidth }));
    setWidth("");
    setHeight("");
  };

  return (
    <FieldSet>
      <FieldLegend variant="label">Sizes</FieldLegend>
      <FieldDescription>
        Tick up to {max}. {ticked.length} ticked.
      </FieldDescription>
      <ScrollArea className="h-64">
        <div className="mr-3 grid gap-3 sm:grid-cols-2">
          {choices.map((choice) => {
            const checked = ticked.includes(choice.id);
            const isCurrent =
              choice.width === current.width &&
              choice.height === current.height;
            const isCustom = choice.id.startsWith("custom-");
            return (
              <FieldLabel key={choice.id} htmlFor={`${idPrefix}-${choice.id}`}>
                <Field orientation="horizontal">
                  <Checkbox
                    id={`${idPrefix}-${choice.id}`}
                    checked={checked}
                    disabled={!checked && full}
                    onCheckedChange={(next) => toggle(choice.id, next)}
                  />
                  <FieldContent>
                    <FieldTitle>
                      {choice.label}
                      {isCurrent ? (
                        <Badge variant="secondary">Current</Badge>
                      ) : null}
                    </FieldTitle>
                    <FieldDescription>
                      {formatSize(choice.width, choice.height)} ·{" "}
                      {choice.description}
                    </FieldDescription>
                  </FieldContent>
                  {isCustom ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${choice.label}`}
                      onClick={(event) => {
                        event.preventDefault();
                        onRemoveCustom(choice.id);
                      }}
                    >
                      <RiCloseLine />
                    </Button>
                  ) : null}
                </Field>
              </FieldLabel>
            );
          })}
        </div>
      </ScrollArea>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor={`${idPrefix}-custom-width`}>
            Width (px)
          </FieldLabel>
          <Input
            id={`${idPrefix}-custom-width`}
            type="number"
            inputMode="numeric"
            min={MIN_CANVAS_SIZE}
            max={MAX_CANVAS_SIZE}
            value={width}
            aria-invalid={invalid || undefined}
            onChange={(event) => setWidth(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
          />
        </Field>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor={`${idPrefix}-custom-height`}>
            Height (px)
          </FieldLabel>
          <Input
            id={`${idPrefix}-custom-height`}
            type="number"
            inputMode="numeric"
            min={MIN_CANVAS_SIZE}
            max={MAX_CANVAS_SIZE}
            value={height}
            aria-invalid={invalid || undefined}
            onChange={(event) => setHeight(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={parsedWidth === null || parsedHeight === null || full}
          onClick={addCustom}
        >
          <RiAddLine data-icon="inline-start" />
          Add size
        </Button>
      </div>
      {invalid ? <FieldError>{SIZE_ERROR}</FieldError> : null}
    </FieldSet>
  );
};
