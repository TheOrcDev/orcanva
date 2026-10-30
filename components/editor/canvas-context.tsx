"use client";

import type Konva from "konva";
import { createContext, use, useRef } from "react";
import type { ReactNode, RefObject } from "react";

// The page content group (background + elements, unscaled design units once
// cloned) is what exports and thumbnails render from.
const PageNodeContext = createContext<RefObject<Konva.Group | null> | null>(
  null
);

export const PageNodeProvider = ({ children }: { children: ReactNode }) => {
  const pageNodeRef = useRef<Konva.Group | null>(null);
  return <PageNodeContext value={pageNodeRef}>{children}</PageNodeContext>;
};

export const usePageNodeRef = (): RefObject<Konva.Group | null> => {
  const ref = use(PageNodeContext);
  if (!ref) {
    throw new Error("usePageNodeRef must be used inside PageNodeProvider");
  }
  return ref;
};
