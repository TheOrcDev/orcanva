"use client";

import { useEffect } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { toast } from "@/components/ui/toast";
import { modelContextOf, registerTools } from "@/lib/webmcp/register";

// The tools load only in browsers that can offer them
const loadTools = () =>
  Promise.all([import("@/lib/webmcp/browser"), import("@/lib/webmcp/tools")]);

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
    const offer = async () => {
      const [{ browserToolDeps }, { editorTools }] = await loadTools();
      if (controller.signal.aborted) {
        return;
      }
      const tools = editorTools(
        browserToolDeps({
          notify: (title) => toast.add({ title, type: "info" }),
          pageNode,
          store,
        })
      );
      await registerTools(context, tools, controller.signal);
    };
    // A chunk that fails to load leaves the editor without agent tools
    offer().catch(() => null);
    return () => controller.abort();
  }, [pageNode, store]);
};
