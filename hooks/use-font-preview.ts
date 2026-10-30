"use client";

import { useEffect, useState } from "react";

import type { FontDefinition } from "@/lib/fonts/catalog";
import { loadFontPreview } from "@/lib/fonts/loader";

// Loads a tiny name-only subset of the font under an alias family and
// returns that alias once it can render (undefined until then)
export const useFontPreview = (font: FontDefinition): string | undefined => {
  const [loaded, setLoaded] = useState<{ id: string; family: string }>();

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const family = await loadFontPreview(font);
        if (active) {
          setLoaded({ family, id: font.id });
        }
      } catch {
        // Fall back to the UI font for this row
      }
    };
    load().catch(() => null);
    return () => {
      active = false;
    };
  }, [font]);

  return loaded?.id === font.id ? loaded.family : undefined;
};
