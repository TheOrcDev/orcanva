import { unstable_isUnrecognizedActionError as isUnrecognizedActionError } from "next/navigation";

import type { EditorStoreApi } from "@/lib/editor/store";

// Server Actions are called by an id that changes with each deploy, so a
// tab opened before one gets "Failed to find Server Action" from then on.
// That stops the editor with a reload prompt (see `outdated` in the store).
// True when the error was that one, so the caller needn't report it.
export const stopIfOutdated = (
  store: EditorStoreApi,
  error: unknown
): boolean => {
  if (!isUnrecognizedActionError(error)) {
    return false;
  }
  store.getState().markOutdated();
  return true;
};
