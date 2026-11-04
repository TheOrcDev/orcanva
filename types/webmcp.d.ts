// WebMCP (Chrome origin trial, behind a flag elsewhere): a page offers tools
// to AI agents in the browser. lib.dom doesn't have it yet:
// https://webmachinelearning.github.io/webmcp/
// The draft moved from navigator.modelContext to document.modelContext;
// polyfills (MCP-B) and older Chrome builds still have the first.

interface ModelContextToolAnnotations {
  // Only reads; agents may call it without asking
  readOnlyHint?: boolean;
  // What it returns may hold text others wrote, so it isn't instructions
  untrustedContentHint?: boolean;
  // Removes or overwrites something
  destructiveHint?: boolean;
}

interface ModelContextTool {
  name: string;
  description: string;
  // JSON Schema for the input object
  inputSchema?: Record<string, unknown>;
  annotations?: ModelContextToolAnnotations;
  execute: (
    input: Record<string, unknown>,
    client?: unknown
  ) => unknown | Promise<unknown>;
}

interface ModelContextRegisterToolOptions {
  // Aborting it unregisters the tool
  signal?: AbortSignal;
}

interface ModelContext {
  // Native: resolves, and the signal unregisters. Older drafts and
  // polyfills: returns a handle with unregister().
  registerTool: (
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions
  ) => // oxlint-disable-next-line typescript/no-invalid-void-type
    Promise<void> | { unregister: () => void } | void;
  unregisterTool?: (name: string) => void;
}

// Missing in browsers without the API
interface Document {
  modelContext?: ModelContext;
}

interface Navigator {
  modelContext?: ModelContext;
}
