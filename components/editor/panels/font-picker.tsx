"use client";

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
import { FONT_CATALOG, FONT_CATEGORY_LABELS } from "@/lib/fonts/catalog";
import type { FontCategory, FontDefinition } from "@/lib/fonts/catalog";

const CATEGORY_ORDER: FontCategory[] = [
  "display",
  "sans",
  "serif",
  "mono",
  "script",
];

const FONT_GROUPS = CATEGORY_ORDER.map((category) => ({
  items: FONT_CATALOG.filter((font) => font.category === category),
  value: FONT_CATEGORY_LABELS[category],
}));

const FontName = ({ font }: { font: FontDefinition }) => {
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

export const FontPicker = ({
  value,
  onChange,
}: {
  value: FontDefinition;
  onChange: (font: FontDefinition) => void;
}) => (
  <Combobox
    items={FONT_GROUPS}
    value={value}
    itemToStringLabel={(font: FontDefinition) => font.family}
    onValueChange={(font: FontDefinition | null) => {
      if (font) {
        onChange(font);
      }
    }}
  >
    <ComboboxInput aria-label="Font" placeholder="Search fonts" />
    <ComboboxContent>
      <ComboboxEmpty>No fonts found.</ComboboxEmpty>
      <ComboboxList>
        {(group: (typeof FONT_GROUPS)[number]) => (
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
