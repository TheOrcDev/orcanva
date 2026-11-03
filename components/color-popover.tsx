"use client";

import { RiAddLine, RiSipLine } from "@remixicon/react";
import { cn } from "cn";
import { useState } from "react";
import { HexAlphaColorPicker } from "react-colorful";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { eyeDropperSupported, pickScreenColor } from "@/lib/editor/eye-dropper";

// The colour picker on its own, with no editor store: a picker with alpha,
// a hex field, the eyedropper, and rows of swatches the caller passes in.
// The editor wraps it (components/editor/panels/color-picker.tsx) to make
// each session one undo step and to fill its rows; Settings uses it as is.

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;

export const DEFAULT_SWATCHES = [
  "#ffffff",
  "#111111",
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#00c7be",
  "#007aff",
  "#5856d6",
  "#af52de",
  "#ff2d55",
  "#8e8e93",
] as const;

export interface SwatchRow {
  // The row's heading, unique among the rows
  label: string;
  colors: readonly string[];
  // A button after the swatches, e.g. one that saves the current colour
  add?: { label: string; onAdd: () => void; disabled?: boolean };
}

export const DEFAULT_SWATCH_ROW: SwatchRow = {
  colors: DEFAULT_SWATCHES,
  label: "Default",
};

export interface ColorPopoverProps {
  // What the colour is for, e.g. "Text color"; names the trigger and fields
  label: string;
  value: string;
  // Every change while it's open: drags, typing, swatches, the eyedropper
  onChange: (color: string) => void;
  // A session starts when it opens and ends when it closes
  onOpenChange?: (open: boolean) => void;
  // Swatch rows, top to bottom. A row with no colours and no add button is
  // left out.
  rows?: readonly SwatchRow[];
  // How the trigger looks: a full-width field with the hex (the default),
  // or just a round swatch, for rows of several colours
  trigger?: "field" | "swatch";
}

// Picks a colour off the screen; only where the browser has an eyedropper
const EyeDropperButton = ({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string;
  onPick: (color: string) => void;
}) => {
  // Popover content only renders in the browser, once opened
  if (!eyeDropperSupported()) {
    return null;
  }

  const handleClick = async () => {
    try {
      const picked = await pickScreenColor(value);
      if (picked) {
        onPick(picked);
      }
    } catch {
      toast.add({ title: "Couldn't pick a color", type: "error" });
    }
  };

  return (
    <InputGroupAddon align="inline-end">
      <InputGroupButton
        size="icon-xs"
        aria-label={`Pick ${label.toLowerCase()} from the screen`}
        title="Pick from the screen"
        onClick={handleClick}
      >
        <RiSipLine />
      </InputGroupButton>
    </InputGroupAddon>
  );
};

const SWATCH_CLASS =
  "ring-foreground/15 hover:ring-ring focus-visible:ring-ring aspect-square rounded-full ring-1 transition-shadow outline-none hover:ring-2 focus-visible:ring-2";

const Swatches = ({
  row,
  onPick,
}: {
  row: SwatchRow;
  onPick: (color: string) => void;
}) => {
  const { add } = row;
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="text-muted-foreground mb-2 p-0 text-xs font-medium">
        {row.label}
      </legend>
      <div className="grid grid-cols-6 gap-2">
        {row.colors.map((color) => (
          <button
            key={color}
            type="button"
            className={cn(SWATCH_CLASS, "bg-(--swatch)")}
            style={{ "--swatch": color }}
            aria-label={`Use ${color}`}
            title={color}
            onClick={() => onPick(color)}
          />
        ))}
        {add ? (
          <button
            type="button"
            className={cn(
              SWATCH_CLASS,
              "text-muted-foreground hover:text-foreground flex items-center justify-center disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4"
            )}
            aria-label={add.label}
            title={add.label}
            disabled={add.disabled}
            onClick={() => add.onAdd()}
          >
            <RiAddLine />
          </button>
        ) : null}
      </div>
    </fieldset>
  );
};

// Default rows, kept stable so they're not new on each render
const DEFAULT_ROWS = [DEFAULT_SWATCH_ROW];

export const ColorPopover = ({
  label,
  value,
  onChange,
  onOpenChange,
  rows = DEFAULT_ROWS,
  trigger = "field",
}: ColorPopoverProps) => {
  // What's typed in the hex field, until it's a colour
  const [draft, setDraft] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setDraft(null);
    }
    onOpenChange?.(open);
  };

  const handleHexChange = (next: string) => {
    const normalized = next.startsWith("#") ? next : `#${next}`;
    setDraft(normalized);
    if (HEX_COLOR.test(normalized)) {
      onChange(normalized.toLowerCase());
    }
  };

  const pick = (color: string) => {
    setDraft(null);
    onChange(color);
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      {trigger === "swatch" ? (
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label={`${label}: ${value}`}
              title={value}
            />
          }
        >
          <span
            className="ring-foreground/15 size-5 rounded-full bg-(--swatch) ring-1"
            style={{ "--swatch": value }}
          />
        </PopoverTrigger>
      ) : (
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className="w-full justify-start"
              aria-label={`${label}: ${value}`}
            />
          }
        >
          <span
            className="ring-foreground/15 size-4 shrink-0 rounded-full bg-(--swatch) ring-1"
            style={{ "--swatch": value }}
            data-icon="inline-start"
          />
          <span className="truncate font-mono text-xs uppercase">{value}</span>
        </PopoverTrigger>
      )}
      <PopoverContent
        className="max-h-(--available-height) w-60 overflow-y-auto"
        align="start"
      >
        <HexAlphaColorPicker
          className="w-full! shrink-0"
          color={value}
          onChange={onChange}
        />
        <InputGroup className="shrink-0">
          <InputGroupAddon>
            <InputGroupText>Hex</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={`${label} hex value`}
            value={draft ?? value}
            spellCheck={false}
            onChange={(event) => handleHexChange(event.target.value)}
          />
          <EyeDropperButton label={label} value={value} onPick={pick} />
        </InputGroup>
        {rows
          .filter((row) => row.colors.length > 0 || row.add)
          .map((row) => (
            <Swatches key={row.label} row={row} onPick={pick} />
          ))}
      </PopoverContent>
    </Popover>
  );
};
