"use client";

import {
  RiFlipHorizontalLine,
  RiFlipVerticalLine,
  RiLayoutMasonryLine,
  RiRulerLine,
} from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { Button } from "@/components/ui/button";
import { useUpdateElement } from "@/hooks/use-selected-element";
import { centerIn, coverSize } from "@/lib/document/geometry";
import type { ImageElement } from "@/lib/document/schema";
import { moveElementTo, updateElement } from "@/lib/editor/document-ops";

export const ImageProperties = ({ element }: { element: ImageElement }) => {
  const store = useEditorStoreApi();
  const update = useUpdateElement(element.id);
  const asset = useEditor((state) =>
    state.assets.find((item) => item.id === element.assetId)
  );
  const maxRadius = Math.round(Math.min(element.width, element.height) / 2);

  // Cover the whole page, send to the bottom, and lock it in place
  const setAsBackground = () => {
    store.getState().change((doc) => {
      const source = asset ?? element;
      const page = { height: doc.height, width: doc.width };
      const size = coverSize(source, page);
      const origin = centerIn(size, page);
      const placed = updateElement(doc, element.id, {
        ...size,
        ...origin,
        locked: true,
        rotation: 0,
      });
      return moveElementTo(placed, element.id, 0);
    });
  };

  // Restore the original aspect ratio, keeping the current width
  const resetRatio = () => {
    if (!asset) {
      return;
    }
    update({ height: (element.width * asset.height) / asset.width });
  };

  return (
    <>
      <PanelSection title="Image">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-pressed={element.flipX}
            onClick={() => update({ flipX: !element.flipX })}
          >
            <RiFlipHorizontalLine data-icon="inline-start" />
            Flip H
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={element.flipY}
            onClick={() => update({ flipY: !element.flipY })}
          >
            <RiFlipVerticalLine data-icon="inline-start" />
            Flip V
          </Button>
          <Button variant="outline" size="sm" onClick={setAsBackground}>
            <RiLayoutMasonryLine data-icon="inline-start" />
            Background
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!asset}
            onClick={resetRatio}
          >
            <RiRulerLine data-icon="inline-start" />
            Reset ratio
          </Button>
        </div>
      </PanelSection>
      <PanelSection title="Corners">
        <TransactionSlider
          label="Radius"
          value={Math.min(element.cornerRadius, maxRadius)}
          min={0}
          max={Math.max(1, maxRadius)}
          format={(value) => `${value}px`}
          onChange={(cornerRadius) => update({ cornerRadius })}
        />
      </PanelSection>
    </>
  );
};
