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
  draw,
  effect,
  fontSize,
  paint,
}: {
  context: CanvasRenderingContext2D;
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
        () => {
          context.shadowColor = effect.color;
          context.shadowBlur = fontSize * (0.1 + 0.5 * strength);
          context.shadowOffsetX = 0;
          context.shadowOffsetY = 0;
        },
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
        () => {
          context.shadowColor = `rgba(0, 0, 0, ${0.2 + 0.4 * strength})`;
          context.shadowBlur = fontSize * 0.25;
          context.shadowOffsetX = 0;
          context.shadowOffsetY = fontSize * 0.08;
        },
        () => draw(paint, 0, 0)
      );
      return;
    }
    default: {
      draw(paint, 0, 0);
    }
  }
};
