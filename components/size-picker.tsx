"use client";

import { useState } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
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
