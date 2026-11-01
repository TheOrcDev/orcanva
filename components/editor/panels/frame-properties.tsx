"use client";

import { PanelSection } from "@/components/editor/panels/panel-section";
import type { FrameElement } from "@/lib/document/schema";

export const FrameProperties = ({ element }: { element: FrameElement }) => (
  <PanelSection title="Frame">
    <p className="text-muted-foreground text-xs">
      {element.assetId
        ? "Double-click the frame to move or zoom the photo inside it."
        : "Drop a photo from Uploads or your computer onto the frame to fill it."}
    </p>
  </PanelSection>
);
