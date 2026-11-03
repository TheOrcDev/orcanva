"use client";

import { useMemo } from "react";

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { useFontPreview } from "@/hooks/use-font-preview";
import type { FontDefinition } from "@/lib/fonts/catalog";
import { fontGroups } from "@/lib/fonts/groups";
import type { FontGroup } from "@/lib/fonts/groups";

// Stable, so the groups aren't rebuilt on every render
const NO_BRAND_FONTS: readonly string[] = [];

// A font's name in that font, once its preview subset loads
export const FontName = ({ font }: { font: FontDefinition }) => {
  const family = useFontPreview(font);
  return (
    <span
      className="font-(family-name:--preview-font) text-base"
      style={{ "--preview-font": family ? `"${family}"` : "inherit" }}
    >
      {font.family}
    </span>
  );
};

// Searchable catalog fonts by category, with the brand kit's fonts on top.
// No store, so Settings uses it too (with no value, to add a font).
export const FontPicker = ({
  value,
  onChange,
  brandFontIds = NO_BRAND_FONTS,
  label = "Font",
  placeholder = "Search fonts",
}: {
  value: FontDefinition | null;
  onChange: (font: FontDefinition) => void;
  brandFontIds?: readonly string[];
  label?: string;
  placeholder?: string;
}) => {
  const groups = useMemo(() => fontGroups(brandFontIds), [brandFontIds]);
  return (
    <Combobox
      items={groups}
      value={value}
      itemToStringLabel={(font: FontDefinition) => font.family}
      onValueChange={(font: FontDefinition | null) => {
        if (font) {
          onChange(font);
        }
      }}
    >
      <ComboboxInput aria-label={label} placeholder={placeholder} />
      <ComboboxContent>
        <ComboboxEmpty>No fonts found.</ComboboxEmpty>
        <ComboboxList>
          {(group: FontGroup) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(font: FontDefinition) => (
                  <ComboboxItem key={font.id} value={font}>
                    <FontName font={font} />
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};
