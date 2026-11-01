import {
  RiAlignItemBottomLine,
  RiAlignItemHorizontalCenterLine,
  RiAlignItemLeftLine,
  RiAlignItemRightLine,
  RiAlignItemTopLine,
  RiAlignItemVerticalCenterLine,
  RiBringForward,
  RiBringToFront,
  RiLayoutColumnLine,
  RiLayoutRowLine,
  RiSendBackward,
  RiSendToBack,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

import type { AlignEdge, DistributeAxis } from "@/lib/editor/align";
import type { ArrangeDirection } from "@/lib/editor/document-ops";

export const ARRANGE_ACTIONS: {
  direction: ArrangeDirection;
  label: string;
  shortcut: string;
  icon: RemixiconComponentType;
}[] = [
  {
    direction: "front",
    icon: RiBringToFront,
    label: "Bring to front",
    shortcut: "⇧⌘]",
  },
  {
    direction: "forward",
    icon: RiBringForward,
    label: "Bring forward",
    shortcut: "⌘]",
  },
  {
    direction: "backward",
    icon: RiSendBackward,
    label: "Send backward",
    shortcut: "⌘[",
  },
  {
    direction: "back",
    icon: RiSendToBack,
    label: "Send to back",
    shortcut: "⇧⌘[",
  },
];

export const ALIGN_ACTIONS: {
  edge: AlignEdge;
  label: string;
  icon: RemixiconComponentType;
}[] = [
  { edge: "left", icon: RiAlignItemLeftLine, label: "Align left" },
  {
    edge: "center",
    icon: RiAlignItemHorizontalCenterLine,
    label: "Align center",
  },
  { edge: "right", icon: RiAlignItemRightLine, label: "Align right" },
  { edge: "top", icon: RiAlignItemTopLine, label: "Align top" },
  {
    edge: "middle",
    icon: RiAlignItemVerticalCenterLine,
    label: "Align middle",
  },
  { edge: "bottom", icon: RiAlignItemBottomLine, label: "Align bottom" },
];

export const DISTRIBUTE_ACTIONS: {
  axis: DistributeAxis;
  label: string;
  icon: RemixiconComponentType;
}[] = [
  { axis: "x", icon: RiLayoutColumnLine, label: "Distribute horizontally" },
  { axis: "y", icon: RiLayoutRowLine, label: "Distribute vertically" },
];
