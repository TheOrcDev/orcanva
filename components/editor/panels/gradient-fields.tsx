"use client";

import { ColorPicker } from "@/components/editor/panels/color-picker";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import type { GradientStop } from "@/lib/document/schema";

export interface LinearGradient {
  angle: number;
  stops: GradientStop[];
}

export const GRADIENT_PRESETS: { name: string; from: string; to: string }[] = [
  { from: "#ff512f", name: "Sunset", to: "#dd2476" },
  { from: "#00c6ff", name: "Ocean", to: "#0072ff" },
  { from: "#f7971e", name: "Gold", to: "#ffd200" },
  { from: "#8e2de2", name: "Violet", to: "#4a00e0" },
  { from: "#11998e", name: "Emerald", to: "#38ef7d" },
  { from: "#141e30", name: "Midnight", to: "#243b55" },
];

export const twoColorGradient = (
  from: string,
  to: string,
  angle: number
): LinearGradient => ({
  angle,
  stops: [
    { color: from, offset: 0 },
    { color: to, offset: 1 },
  ],
});

const withStop = <T extends LinearGradient>(
  gradient: T,
  index: number,
  color: string
): T => ({
  ...gradient,
  stops: gradient.stops.map((stop, stopIndex) =>
    stopIndex === index ? { ...stop, color } : stop
  ),
});

// Start and end colors, the angle, and one-tap presets
export const GradientFields = <T extends LinearGradient>({
  value,
  onChange,
}: {
  value: T;
  onChange: (next: T) => void;
}) => (
  <>
    <div className="grid grid-cols-2 gap-2">
      <ColorPicker
        label="Gradient start"
        value={value.stops[0]?.color ?? "#ffffff"}
        onChange={(color) => onChange(withStop(value, 0, color))}
      />
      <ColorPicker
        label="Gradient end"
        value={value.stops.at(-1)?.color ?? "#000000"}
        onChange={(color) =>
          onChange(withStop(value, value.stops.length - 1, color))
        }
      />
    </div>
    <TransactionSlider
      label="Angle"
      value={value.angle}
      min={0}
      max={360}
      format={(angle) => `${angle}°`}
      onChange={(angle) => onChange({ ...value, angle })}
    />
    <div className="grid grid-cols-6 gap-2">
      {GRADIENT_PRESETS.map((preset) => (
        <button
          key={preset.name}
          type="button"
          aria-label={`${preset.name} gradient`}
          title={preset.name}
          className="ring-foreground/15 hover:ring-ring aspect-square rounded-full bg-linear-to-br from-(--from) to-(--to) ring-1 transition-shadow hover:ring-2"
          style={{ "--from": preset.from, "--to": preset.to }}
          onClick={() =>
            onChange({
              ...value,
              ...twoColorGradient(preset.from, preset.to, value.angle),
            })
          }
        />
      ))}
    </div>
  </>
);
