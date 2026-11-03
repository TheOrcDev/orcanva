import type { GraphicElement, GraphicLayer } from "@/lib/document/schema";

// The colour a palette index paints, or null for none (an index past the
// palette's end included)
export const paletteColor = (
  palette: readonly string[],
  index: number | null
): string | null => (index === null ? null : (palette[index] ?? null));

const strokes = (layer: GraphicLayer): boolean =>
  layer.stroke !== null && layer.strokeWidth > 0;

// The palette entries some visible layer paints with, in the order the art
// first uses them; entries nothing uses don't show, so they aren't offered
export const paintedIndexes = (
  graphic: Pick<GraphicElement, "layers" | "palette">
): number[] => {
  const used = new Set<number>();
  for (const layer of graphic.layers) {
    if (layer.opacity === 0) {
      continue;
    }
    if (layer.fill !== null && layer.fill < graphic.palette.length) {
      used.add(layer.fill);
    }
    if (
      strokes(layer) &&
      layer.stroke !== null &&
      layer.stroke < graphic.palette.length
    ) {
      used.add(layer.stroke);
    }
  }
  return [...used];
};
