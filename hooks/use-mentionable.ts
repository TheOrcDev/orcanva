"use client";

import { useEffect } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { canMention } from "@/lib/auth/access";
import { fetchMentionable } from "@/lib/comments/api";
import type { MentionPerson } from "@/lib/comments/schema";

const NOBODY: readonly MentionPerson[] = [];

// Who this person can mention in a comment, other than themselves: loaded
// once per editor, the first time a composer needs it, and only for the
// owner and members (canMention). Others get nobody.
export const useMentionable = (): readonly MentionPerson[] => {
  const store = useEditorStoreApi();
  const allowed = useEditor((state) => canMention(state.role));
  const people = useEditor((state) => state.mentionable);
  const viewerId = useEditor((state) => state.viewer?.id ?? null);

  useEffect(() => {
    if (!allowed || people !== null) {
      return;
    }
    let current = true;
    const load = async () => {
      try {
        const list = await fetchMentionable(store.getState().designId);
        if (current) {
          store.getState().setMentionable(list);
        }
      } catch {
        // Without the list, mentions just aren't offered
      }
    };
    load().catch(() => null);
    return () => {
      current = false;
    };
  }, [allowed, people, store]);

  if (!(allowed && people)) {
    return NOBODY;
  }
  return people.filter((person) => person.id !== viewerId);
};
