"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Arrangement } from "@/components/youtube-preview/feed";
import { PREVIEW_THEMES } from "@/lib/youtube-preview/details";
import type { PreviewTheme } from "@/lib/youtube-preview/details";
import { LAYOUTS } from "@/lib/youtube-preview/layout";
import type { LayoutId } from "@/lib/youtube-preview/layout";

const THEME_LABELS = { dark: "Dark", light: "Light" } as const;

const ARRANGEMENTS: { label: string; value: Arrangement }[] = [
  { label: "Mixed in", value: "mixed" },
  { label: "Side by side", value: "side" },
];

// Which page the mock draws, in which look, and, once there's something to
// compare with, whether the compares mix with other videos
export const ViewControls = ({
  arrangement,
  layout,
  onArrangementChange,
  onLayoutChange,
  onThemeChange,
  theme,
}: {
  // Left out while there's nothing to compare with
  arrangement?: Arrangement;
  layout: LayoutId;
  onArrangementChange?: (arrangement: Arrangement) => void;
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
    {arrangement && onArrangementChange ? (
      <ToggleGroup
        aria-label="Compare"
        variant="outline"
        size="sm"
        value={[arrangement]}
        onValueChange={(value) => {
          const next = ARRANGEMENTS.find((item) => item.value === value[0]);
          if (next) {
            onArrangementChange(next.value);
          }
        }}
      >
        {ARRANGEMENTS.map((item) => (
          <ToggleGroupItem key={item.value} value={item.value}>
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    ) : null}
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
