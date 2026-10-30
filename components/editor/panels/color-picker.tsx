"use client";

import { useState } from "react";
import { HexAlphaColorPicker } from "react-colorful";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;

export const SWATCHES = [
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
];

export interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

// One popover session (drags, typing, swatch clicks) is one undo step
export const ColorPicker = ({ label, value, onChange }: ColorPickerProps) => {
  const store = useEditorStoreApi();
  const [draft, setDraft] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      store.getState().begin();
    } else {
      setDraft(null);
      store.getState().end();
    }
  };

  const handleHexChange = (next: string) => {
    const normalized = next.startsWith("#") ? next : `#${next}`;
    setDraft(normalized);
    if (HEX_COLOR.test(normalized)) {
      onChange(normalized.toLowerCase());
    }
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
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
      <PopoverContent className="w-60" align="start">
        <HexAlphaColorPicker
          className="w-full!"
          color={value}
          onChange={onChange}
        />
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>Hex</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={`${label} hex value`}
            value={draft ?? value}
            spellCheck={false}
            onChange={(event) => handleHexChange(event.target.value)}
          />
        </InputGroup>
        <div className="grid grid-cols-6 gap-2">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className="ring-foreground/15 hover:ring-ring aspect-square rounded-full bg-(--swatch) ring-1 transition-shadow hover:ring-2"
              style={{ "--swatch": swatch }}
              aria-label={`Use ${swatch}`}
              onClick={() => {
                setDraft(null);
                onChange(swatch);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
