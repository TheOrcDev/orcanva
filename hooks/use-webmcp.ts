"use client";

import { useEffect } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { toast } from "@/components/ui/toast";
import { browserToolDeps } from "@/lib/webmcp/browser";
import { modelContextOf, registerTools } from "@/lib/webmcp/register";
import { editorTools } from "@/lib/webmcp/tools";

// Offers the editor's tools to an AI agent in the browser through WebMCP,
// while the editor is open, in browsers that have it (nothing happens in
// the others)
export const useWebMcp = () => {
  const store = useEditorStoreApi();
  const pageNode = usePageNodeRef();

  useEffect(() => {
    const context = modelContextOf(document, navigator);
    if (!context) {
      return;
    }
    const controller = new AbortController();
    const tools = editorTools(
      browserToolDeps({
        notify: (title) => toast.add({ title, type: "info" }),
        pageNode,
        store,
      })
    );
    registerTools(context, tools, controller.signal);
    return () => controller.abort();
  }, [pageNode, store]);
};
