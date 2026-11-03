"use client";

import { useRef, useState } from "react";

import { ColorPopover, DEFAULT_SWATCH_ROW } from "@/components/color-popover";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { documentColors } from "@/lib/document/palette";
import {
  loadRecentColors,
  rememberRecentColor,
} from "@/lib/editor/recent-colors";
import { selectDocument } from "@/lib/editor/store";

export interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

interface Gathered {
  design: string[];
  recent: string[];
}

const NOTHING_YET: Gathered = { design: [], recent: [] };

// The editor's colour picker. One popover session (drags, typing, swatch
// clicks, the eyedropper) is one undo step. When it opens it gathers the
// design's own colours and this browser's recent ones; when it closes on a
// new colour, that colour becomes the most recent.
export const ColorPicker = ({ label, value, onChange }: ColorPickerProps) => {
  const store = useEditorStoreApi();
  const [gathered, setGathered] = useState<Gathered>(NOTHING_YET);
  // The colour when the session started
  const openedWith = useRef<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      openedWith.current = value;
      setGathered({
        design: documentColors(selectDocument(store.getState())),
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

  return (
    <ColorPopover
      label={label}
      value={value}
      onChange={onChange}
      onOpenChange={handleOpenChange}
      rows={[
        { colors: gathered.design, label: "In this design" },
        { colors: gathered.recent, label: "Recent" },
        DEFAULT_SWATCH_ROW,
      ]}
    />
  );
};
