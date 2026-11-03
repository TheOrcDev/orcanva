"use client";

import {
  RiChat3Line,
  RiEmotionLine,
  RiImageLine,
  RiLayoutMasonryLine,
  RiShapesLine,
  RiStackLine,
  RiText,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";

import {
  CommentsPanel,
  OpenCommentCount,
} from "@/components/editor/comments/comments-panel";
import { GraphicsPanel } from "@/components/editor/panels/graphics-panel";
import { LayersPanel } from "@/components/editor/panels/layers-panel";
import { ShapesPanel } from "@/components/editor/panels/shapes-panel";
import { TemplatesPanel } from "@/components/editor/panels/templates-panel";
import { TextPanel } from "@/components/editor/panels/text-panel";
import { UploadsPanel } from "@/components/editor/panels/uploads-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SidebarTab {
  value: string;
  label: string;
  icon: RemixiconComponentType;
  panel: ReactNode;
  // Shown on the tab, e.g. how many comments are open
  badge?: ReactNode;
}

const TABS: SidebarTab[] = [
  {
    icon: RiLayoutMasonryLine,
    label: "Templates",
    panel: <TemplatesPanel />,
    value: "templates",
  },
  {
    icon: RiImageLine,
    label: "Uploads",
    panel: <UploadsPanel />,
    value: "uploads",
  },
  {
    icon: RiText,
    label: "Text",
    panel: <TextPanel />,
    value: "text",
  },
  {
    icon: RiShapesLine,
    label: "Shapes",
    panel: <ShapesPanel />,
    value: "shapes",
  },
  {
    icon: RiEmotionLine,
    label: "Graphics",
    panel: <GraphicsPanel />,
    value: "graphics",
  },
  {
    icon: RiStackLine,
    label: "Layers",
    panel: <LayersPanel />,
    value: "layers",
  },
  {
    badge: <OpenCommentCount />,
    icon: RiChat3Line,
    label: "Comments",
    panel: <CommentsPanel />,
    value: "comments",
  },
];

export const EditorSidebar = () => (
  <aside className="bg-background flex shrink-0 border-r" aria-label="Tools">
    {/* Templates sit on top as a place to start, but Uploads open first */}
    <Tabs defaultValue="uploads" orientation="vertical">
      <div className="border-r p-2">
        <TabsList variant="line">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="relative flex-col"
              aria-label={tab.label}
            >
              <tab.icon />
              <span className="text-xs">{tab.label}</span>
              {tab.badge}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="w-72">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-6 p-4">{tab.panel}</div>
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  </aside>
);
