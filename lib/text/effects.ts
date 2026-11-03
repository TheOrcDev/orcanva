import type { TextEffect } from "@/lib/document/schema";
import type { TextPaint } from "@/lib/text/canvas";

// Canva-style text effects, one at a time per text. Effects are painting
// passes around the text's own: copies under it, or a different paint.

export const TEXT_EFFECTS = [
  { kind: "hollow", label: "Hollow" },
  { kind: "splice", label: "Splice" },
  { kind: "echo", label: "Echo" },
  { kind: "glitch", label: "Glitch" },
  { kind: "neon", label: "Neon" },
  { kind: "lift", label: "Lift" },
] as const;

export type TextEffectKind = (typeof TEXT_EFFECTS)[number]["kind"];

const DEFAULT_COLORS: Record<TextEffectKind, string> = {
  echo: "#111111",
  glitch: "#00e5ff",
  hollow: "#111111",
  lift: "#000000",
  neon: "#ff2e93",
  splice: "#ffd60a",
};

export const defaultEffect = (kind: TextEffectKind): TextEffect => ({
  angle: 45,
  color: DEFAULT_COLORS[kind],
  intensity: 50,
  kind,
  offsetEm: kind === "glitch" ? 0.04 : 0.08,
});

// Which effect settings mean something for a kind
export const effectControls = (
  kind: string
): { color: boolean; intensity: boolean; offset: boolean } => ({
  color: kind !== "lift",
  intensity: kind === "hollow" || kind === "neon" || kind === "lift",
  offset: kind === "splice" || kind === "echo" || kind === "glitch",
});

const CLEAR = "rgba(0, 0, 0, 0)";
// Glitch's second copy
const GLITCH_MAGENTA = "#ff2bd6";

// Draws the text once with a paint, shifted by dx, dy
export type DrawText = (paint: TextPaint, dx: number, dy: number) => void;

// Device pixels per page unit on each axis: the text's absolute scale (zoom
// included) times the canvas's pixel ratio
export interface DeviceScale {
  x: number;
  y: number;
}

export interface Shadow {
  blur: number;
  offsetX: number;
  offsetY: number;
}

// Canvas shadows ignore the context's transform: their blur and offsets are
// in device pixels. Converts one given in page units the way Konva converts
// its own shadows, so it looks the same at any zoom and in a 2× export.
export const deviceShadow = (shadow: Shadow, scale: DeviceScale): Shadow => ({
  blur: shadow.blur * Math.min(Math.abs(scale.x), Math.abs(scale.y)),
  offsetX: shadow.offsetX * scale.x,
  offsetY: shadow.offsetY * scale.y,
});

const applyShadow = (
  context: CanvasRenderingContext2D,
  color: string,
  shadow: Shadow,
  scale: DeviceScale
) => {
  const device = deviceShadow(shadow, scale);
  context.shadowColor = color;
  context.shadowBlur = device.blur;
  context.shadowOffsetX = device.offsetX;
  context.shadowOffsetY = device.offsetY;
};

const withContext = (
  context: CanvasRenderingContext2D,
  apply: () => void,
  draw: () => void
) => {
  context.save();
  apply();
  draw();
  context.restore();
};

// Paints text with an effect: copies first, then the text (or, for hollow
// and splice, its outline)
export const paintWithEffect = ({
  context,
  deviceScale,
  draw,
  effect,
  fontSize,
  paint,
}: {
  context: CanvasRenderingContext2D;
  deviceScale: DeviceScale;
  draw: DrawText;
  effect: TextEffect | null;
  fontSize: number;
  paint: TextPaint;
}) => {
  if (!effect) {
    draw(paint, 0, 0);
    return;
  }
  const strength = Math.min(100, Math.max(0, effect.intensity)) / 100;
  const radians = (effect.angle * Math.PI) / 180;
  const dx = Math.cos(radians) * effect.offsetEm * fontSize;
  const dy = Math.sin(radians) * effect.offsetEm * fontSize;
  const outline = Math.max(1, fontSize * (0.02 + 0.06 * strength));
  const plain = { ...paint, stroke: null, strokeWidth: 0 };

  switch (effect.kind) {
    case "hollow": {
      draw({ fill: CLEAR, stroke: effect.color, strokeWidth: outline }, 0, 0);
      return;
    }
    case "splice": {
      draw({ fill: effect.color, stroke: null, strokeWidth: 0 }, dx, dy);
      draw(
        {
          fill: CLEAR,
          stroke: typeof paint.fill === "string" ? paint.fill : effect.color,
          strokeWidth: outline,
        },
        0,
        0
      );
      return;
    }
    case "echo": {
      for (const step of [3, 2, 1]) {
        withContext(
          context,
          () => {
            context.globalAlpha *= 0.55 - step * 0.12;
          },
          () =>
            draw(
              { fill: effect.color, stroke: null, strokeWidth: 0 },
              dx * step,
              dy * step
            )
        );
      }
      draw(paint, 0, 0);
      return;
    }
    case "glitch": {
      draw({ fill: effect.color, stroke: null, strokeWidth: 0 }, -dx, -dy);
      draw({ fill: GLITCH_MAGENTA, stroke: null, strokeWidth: 0 }, dx, dy);
      draw(paint, 0, 0);
      return;
    }
    case "neon": {
      withContext(
        context,
        () =>
          applyShadow(
            context,
            effect.color,
            { blur: fontSize * (0.1 + 0.5 * strength), offsetX: 0, offsetY: 0 },
            deviceScale
          ),
        () => {
          draw(plain, 0, 0);
          draw(plain, 0, 0);
        }
      );
      draw(paint, 0, 0);
      return;
    }
    case "lift": {
      withContext(
        context,
        () =>
          applyShadow(
            context,
            `rgba(0, 0, 0, ${0.2 + 0.4 * strength})`,
            { blur: fontSize * 0.25, offsetX: 0, offsetY: fontSize * 0.08 },
            deviceScale
          ),
        () => draw(paint, 0, 0)
      );
      return;
    }
    default: {
      draw(paint, 0, 0);
    }
  }
};
