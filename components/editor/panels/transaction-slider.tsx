"use client";

import { useId } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { Field, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";

export interface TransactionSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

const firstValue = (value: number | readonly number[]): number =>
  typeof value === "number" ? value : (value[0] ?? 0);

// A whole scrub is one undo step: begin on first change, end on release
export const TransactionSlider = ({
  label,
  value,
  min,
  max,
  step = 1,
  format = String,
  onChange,
}: TransactionSliderProps) => {
  const store = useEditorStoreApi();
  // Names the thumb's range input itself, which is what screen readers
  // (and tests) find; an aria-label on the root only names the group
  const labelId = useId();

  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel id={labelId}>{label}</FieldLabel>
        <span className="text-muted-foreground text-xs tabular-nums">
          {format(value)}
        </span>
      </div>
      <Slider
        aria-labelledby={labelId}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => {
          store.getState().begin();
          onChange(firstValue(next));
        }}
        onValueCommitted={() => store.getState().end()}
      />
    </Field>
  );
};
