import type { CurvedLayout } from "@/lib/text/curve";
import type {
  FontBox,
  Measurer,
  TextLayout,
  TextStyle,
} from "@/lib/text/layout";

// The font string Konva's Text builds: style, variant, size, family
export const canvasFont = ({
  family,
  fontSize,
  italic,
  weight,
}: {
  family: string;
  fontSize: number;
  italic: boolean;
  weight: number;
}): string =>
  `${italic ? "italic " : ""}${weight} normal ${fontSize}px ${family}`;

let measuringContext: CanvasRenderingContext2D | null = null;

const contextForMeasuring = (): CanvasRenderingContext2D => {
  if (!measuringContext) {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D is not available");
    }
    measuringContext = context;
  }
  return measuringContext;
};

const fontBoxes = new Map<string, FontBox>();

// Measures like Konva: kerning off for spaced letters (drawn one by one),
// and the baseline from the font's box around "M"
export const canvasMeasurer: Measurer = {
  fontBox: (style) => {
    const known = fontBoxes.get(style.font);
    if (known) {
      return known;
    }
    const context = contextForMeasuring();
    context.font = style.font;
    const metrics = context.measureText("M");
    const box = {
      ascent: metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent,
      descent:
        metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent,
    };
    // Fallback fonts measure differently: only keep real faces
    if (document.fonts.check(style.font)) {
      fontBoxes.set(style.font, box);
    }
    return box;
  },
  width: (text, style) => {
    const context = contextForMeasuring();
    context.font = style.font;
    context.fontKerning = style.letterSpacing === 0 ? "auto" : "none";
    return context.measureText(text).width;
  },
};

export interface TextPaint {
  fill: string | CanvasGradient;
  stroke: string | null;
  strokeWidth: number;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Underline and strikethrough as Konva's Text draws them: a line a
// fifteenth of the size thick, a quarter of the size below or above the
// baseline
const paintDecorations = (
  context: CanvasRenderingContext2D,
  piece: { style: TextStyle; width: number },
  baseline: number,
  x: number,
  color: string | CanvasGradient
) => {
  const { fontSize, strike, underline } = piece.style;
  const offsets = [
    ...(underline ? [Math.round(fontSize / 4)] : []),
    ...(strike ? [-Math.round(fontSize / 4)] : []),
  ];
  if (offsets.length === 0) {
    return;
  }
  context.save();
  context.strokeStyle = color;
  context.lineWidth = fontSize / 15;
  for (const offset of offsets) {
    context.beginPath();
    context.moveTo(x, baseline + offset);
    context.lineTo(x + piece.width, baseline + offset);
    context.stroke();
  }
  context.restore();
};

// Paints curved text letter by letter, each turned along the arc
export const paintCurvedText = <S extends TextStyle>(
  context: CanvasRenderingContext2D,
  layout: CurvedLayout<S>,
  paintOf: (style: S) => TextPaint
) => {
  context.textBaseline = "alphabetic";
  context.textAlign = "left";
  context.lineJoin = "round";
  for (const glyph of layout.glyphs) {
    const paint = paintOf(glyph.style);
    context.save();
    context.translate(glyph.x, glyph.y);
    context.rotate(glyph.rotation);
    context.font = glyph.style.font;
    context.fillStyle = paint.fill;
    if (paint.stroke && paint.strokeWidth > 0) {
      context.strokeStyle = paint.stroke;
      context.lineWidth = paint.strokeWidth;
      context.strokeText(glyph.text, -glyph.width / 2, 0);
    }
    context.fillText(glyph.text, -glyph.width / 2, 0);
    context.restore();
  }
};

// Paints a laid out text the way Konva's Text paints one style: the outline
// first, then the fill on top; spaced letters one at a time
export const paintTextLayout = <S extends TextStyle>(
  context: CanvasRenderingContext2D,
  layout: TextLayout<S>,
  paintOf: (style: S) => TextPaint
) => {
  context.textBaseline = "alphabetic";
  context.textAlign = "left";
  context.lineJoin = "round";
  for (const line of layout.lines) {
    for (const piece of line.pieces) {
      const paint = paintOf(piece.style);
      context.font = piece.style.font;
      context.fillStyle = paint.fill;
      if (paint.stroke) {
        context.strokeStyle = paint.stroke;
        context.lineWidth = paint.strokeWidth;
      }
      const draw = (text: string, x: number) => {
        if (paint.stroke && paint.strokeWidth > 0) {
          context.strokeText(text, x, line.baseline);
        }
        context.fillText(text, x, line.baseline);
      };
      const start = line.x + piece.x;
      if (piece.style.letterSpacing === 0) {
        draw(piece.text, start);
      } else {
        let x = start;
        for (const { segment } of segmenter.segment(piece.text)) {
          draw(segment, x);
          x += context.measureText(segment).width + piece.style.letterSpacing;
        }
      }
      paintDecorations(context, piece, line.baseline, start, paint.fill);
    }
  }
};
