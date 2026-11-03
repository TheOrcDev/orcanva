import type { GraphicArt } from "@/lib/graphics/entry";
import { paletteColor } from "@/lib/graphics/paint";

// A graphic's art as an inline SVG, for tiles and buttons. The canvas draws
// the same layers itself (lib/graphics/draw.ts).
export const GraphicSvg = ({
  art,
  className,
}: {
  art: GraphicArt;
  className?: string;
}) => (
  <svg viewBox={art.viewBox.join(" ")} className={className} aria-hidden>
    {art.layers.map((layer, index) => {
      const stroke = paletteColor(art.palette, layer.stroke);
      return (
        <path
          // Layers have no ids, and a graphic's list never changes order
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          d={layer.d}
          fill={paletteColor(art.palette, layer.fill) ?? "none"}
          fillRule={layer.fillRule}
          opacity={layer.opacity}
          stroke={stroke ?? "none"}
          strokeLinecap={layer.lineCap}
          strokeLinejoin={layer.lineJoin}
          strokeWidth={stroke ? layer.strokeWidth : 0}
        />
      );
    })}
  </svg>
);
