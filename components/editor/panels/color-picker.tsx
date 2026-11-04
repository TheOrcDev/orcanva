"use client";

import { useRef, useState } from "react";

import { ColorPopover, DEFAULT_SWATCH_ROW } from "@/components/color-popover";
import type { SwatchRow } from "@/components/color-popover";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { useBrandKitChange } from "@/hooks/use-brand-kit";
import { isBrandKitFull } from "@/lib/brand-kit/schema";
import type { BrandKit } from "@/lib/brand-kit/schema";
import { normalizeHex } from "@/lib/document/color";
import { documentColors } from "@/lib/document/palette";
import {
  loadRecentColors,
  rememberRecentColor,
} from "@/lib/editor/recent-colors";
import { selectWholeDesign } from "@/lib/editor/store";

export interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  // A round swatch instead of a field (see ColorPopover)
  trigger?: "field" | "swatch";
}

interface Gathered {
  design: string[];
  recent: string[];
}

const NOTHING_YET: Gathered = { design: [], recent: [] };

// The signed-in viewer's brand colours, with a + that saves the current one
const brandRow = (
  kit: BrandKit,
  value: string,
  onAdd: () => void
): SwatchRow => {
  const current = normalizeHex(value);
  const saved = current !== null && kit.colors.includes(current);
  const full = isBrandKitFull(kit, "color");
  let label = "Add this color to your brand kit";
  if (saved) {
    label = "This color is in your brand kit";
  } else if (full) {
    label = "Your brand kit is full";
  }
  return {
    add: { disabled: saved || full || current === null, label, onAdd },
    colors: kit.colors,
    label: "Brand",
  };
};

// The editor's colour picker. One popover session (drags, typing, swatch
// clicks, the eyedropper) is one undo step. When it opens it gathers the
// design's own colours and this browser's recent ones; when it closes on a
// new colour, that colour becomes the most recent. Signed in, the brand
// kit's colours come first.
export const ColorPicker = ({
  label,
  value,
  onChange,
  trigger,
}: ColorPickerProps) => {
  const store = useEditorStoreApi();
  const brandKit = useEditor((state) => state.brandKit);
  const changeBrandKit = useBrandKitChange();
  const [gathered, setGathered] = useState<Gathered>(NOTHING_YET);
  // The colour when the session started
  const openedWith = useRef<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      openedWith.current = value;
      setGathered({
        design: documentColors(selectWholeDesign(store.getState())),
        recent: loadRecentColors(),
      });
      store.getState().begin();
      return;
    }
    store.getState().end();
    if (openedWith.current !== null && value !== openedWith.current) {
      rememberRecentColor(value);
    }
    openedWith.current = null;
  };

  const rows: SwatchRow[] = [
    { colors: gathered.design, label: "In this design" },
    { colors: gathered.recent, label: "Recent" },
    DEFAULT_SWATCH_ROW,
  ];
  if (brandKit) {
    rows.unshift(
      brandRow(brandKit, value, () => {
        changeBrandKit({ kind: "color", value }, true).catch(() => null);
      })
    );
  }

  return (
    <ColorPopover
      label={label}
      value={value}
      onChange={onChange}
      onOpenChange={handleOpenChange}
      rows={rows}
      trigger={trigger}
    />
  );
};
