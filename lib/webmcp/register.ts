// Offers tools to the browser's AI agent through WebMCP, when the browser
// has it: document.modelContext as the draft has it now, or
// navigator.modelContext as older Chrome builds and polyfills do

export const modelContextOf = (
  doc: Pick<Document, "modelContext"> | undefined,
  nav: Pick<Navigator, "modelContext"> | undefined
): ModelContext | null => doc?.modelContext ?? nav?.modelContext ?? null;

const hasUnregister = (value: unknown): value is { unregister: () => void } =>
  typeof value === "object" &&
  value !== null &&
  "unregister" in value &&
  typeof value.unregister === "function";

// Registers every tool until `signal` aborts. A tool the browser refuses
// (a name taken, a schema it can't read) is skipped rather than taking the
// rest down with it; returns the names that were registered.
export const registerTools = async (
  context: ModelContext,
  tools: readonly ModelContextTool[],
  signal: AbortSignal
): Promise<string[]> => {
  const registered: string[] = [];
  for (const tool of tools) {
    if (signal.aborted) {
      break;
    }
    try {
      // One at a time: registration order is the order agents list them
      // oxlint-disable-next-line no-await-in-loop
      const handle = await context.registerTool(tool, { signal });
      registered.push(tool.name);
      const unregister = hasUnregister(handle)
        ? () => handle.unregister()
        : () => context.unregisterTool?.(tool.name);
      // Natively the signal does it; older drafts need asking. Removing a
      // tool twice is harmless, but a polyfill might throw.
      signal.addEventListener(
        "abort",
        () => {
          try {
            unregister();
          } catch {
            // Already gone
          }
        },
        { once: true }
      );
    } catch {
      // Left out; the others still work
    }
  }
  return registered;
};
