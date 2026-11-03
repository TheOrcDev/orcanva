"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PREVIEW_THEMES } from "@/lib/youtube-preview/details";
import type { PreviewTheme } from "@/lib/youtube-preview/details";
import { LAYOUTS } from "@/lib/youtube-preview/layout";
import type { LayoutId } from "@/lib/youtube-preview/layout";

const THEME_LABELS = { dark: "Dark", light: "Light" } as const;

// Which page the mock draws, and in which look, above the mock
export const ViewControls = ({
  layout,
  onLayoutChange,
  onThemeChange,
  theme,
}: {
  layout: LayoutId;
  onLayoutChange: (layout: LayoutId) => void;
  onThemeChange: (theme: PreviewTheme) => void;
  theme: PreviewTheme;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <ToggleGroup
      aria-label="Layout"
      variant="outline"
      size="sm"
      value={[layout]}
      onValueChange={(value) => {
        const next = LAYOUTS.find((item) => item.id === value[0]);
        if (next) {
          onLayoutChange(next.id);
        }
      }}
    >
      {LAYOUTS.map((item) => (
        <ToggleGroupItem key={item.id} value={item.id}>
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
    <ToggleGroup
      aria-label="Look"
      variant="outline"
      size="sm"
      value={[theme]}
      onValueChange={(value) => {
        const next = PREVIEW_THEMES.find((item) => item === value[0]);
        if (next) {
          onThemeChange(next);
        }
      }}
    >
      {PREVIEW_THEMES.map((item) => (
        <ToggleGroupItem key={item} value={item}>
          {THEME_LABELS[item]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  </div>
);
