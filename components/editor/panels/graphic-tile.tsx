"use client";

import { GraphicSvg } from "@/components/editor/panels/graphic-svg";
import { useInsertElement } from "@/hooks/use-insert-element";
import { createGraphicElement } from "@/lib/document/factories";
import type { GraphicEntry } from "@/lib/graphics/entry";

// A graphic to click onto the canvas
export const GraphicTile = ({ graphic }: { graphic: GraphicEntry }) => {
  const insert = useInsertElement();

  return (
    <button
      type="button"
      className="bg-muted hover:ring-ring focus-visible:ring-ring block aspect-square w-full rounded-xl p-2 transition-shadow outline-none hover:ring-2 focus-visible:ring-2"
      aria-label={`Add ${graphic.name}`}
      title={graphic.name}
      onClick={() => insert((page) => createGraphicElement(graphic, page))}
    >
      <GraphicSvg art={graphic} className="pointer-events-none size-full" />
    </button>
  );
};
