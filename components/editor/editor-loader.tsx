"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { EditorInit } from "@/lib/editor/store";

const EditorSkeleton = () => (
  <div className="flex h-svh flex-col">
    <div className="flex h-14 items-center gap-2 border-b px-3">
      <Skeleton className="size-9" />
      <Skeleton className="h-9 w-56" />
    </div>
    <div className="flex flex-1">
      <Skeleton className="m-4 w-72" />
      <Skeleton className="m-4 flex-1" />
      <Skeleton className="m-4 w-64" />
    </div>
  </div>
);

// Konva touches window on import, so the editor only ever renders client-side
const Editor = dynamic(
  () => import("@/components/editor/editor").then((mod) => mod.Editor),
  { loading: EditorSkeleton, ssr: false }
);

export const EditorLoader = (init: EditorInit) => <Editor init={init} />;
