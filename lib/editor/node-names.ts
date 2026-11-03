import type Konva from "konva";

// Konva node names shared by the live canvas and offscreen exports
export const BACKGROUND_NODE_NAME = "page-background";
export const ELEMENT_NODE_NAME = "design-element";
// The Konva Image showing an image's or a frame's photo
export const PHOTO_NODE_NAME = "photo";
// The outline, glow and shadow drawn behind it
export const PHOTO_EFFECTS_NAME = "photo-effects";

// The nodes of a tool's own UI on the canvas (cropping, the page crop, the
// magic eraser): pressing anything else ends cropping, and presses on them
// never select or drag what's underneath
export const TOOL_UI_NAME = "tool-ui";

export const isToolUi = (node: Konva.Node): boolean =>
  node.hasName(TOOL_UI_NAME) || Boolean(node.findAncestor(`.${TOOL_UI_NAME}`));

// Where a side-handle crop has got to, kept on the photo's node until the
// gesture is baked
export const LIVE_CROP_ATTR = "liveCrop";

// The photo inside an element's node (a frame keeps it in its clip group).
// Found by name: the element holds other shapes, its effects among them.
export const photoNodeOf = (
  element: Konva.Container
): Konva.Image | undefined =>
  element.findOne<Konva.Image>(`.${PHOTO_NODE_NAME}`);
