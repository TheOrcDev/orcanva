"use client";

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Transformer } from "react-konva";

const ACCENT = "#2563eb";

// A dashed outline around selected elements the handles leave out (locked
// ones in a multi-selection). A non-interactive Transformer follows the
// nodes' size and rotation for free.
export const SelectionOutline = ({ ids }: { ids: string[] }) => {
  const transformerRef = useRef<Konva.Transformer>(null);
  const key = ids.join(" ");

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = transformer?.getStage();
    if (!(transformer && stage)) {
      return;
    }
    const nodes = key
      .split(" ")
      .filter(Boolean)
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => node !== undefined);
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [key]);

  return (
    <Transformer
      ref={transformerRef}
      borderStroke={ACCENT}
      borderDash={[4, 4]}
      enabledAnchors={[]}
      ignoreStroke
      listening={false}
      resizeEnabled={false}
      rotateEnabled={false}
    />
  );
};
