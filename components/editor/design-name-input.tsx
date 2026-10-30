"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Input } from "@/components/ui/input";

export const DesignNameInput = () => {
  const store = useEditorStoreApi();
  const name = useEditor((state) => state.name);
  const isOwner = useEditor((state) => state.role === "owner");
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) {
      return;
    }
    const next = draft.trim();
    setDraft(null);
    if (next && next !== name) {
      store.getState().rename(next.slice(0, 120));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commit();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setDraft(null);
      event.currentTarget.blur();
    }
  };

  // Only the owner renames; everyone else sees the name as it is
  if (!isOwner) {
    return (
      <Input aria-label="Design name" className="w-56" value={name} readOnly />
    );
  }

  return (
    <Input
      aria-label="Design name"
      className="w-56"
      maxLength={120}
      value={draft ?? name}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  );
};
