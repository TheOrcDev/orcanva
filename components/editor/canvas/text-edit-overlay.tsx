"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import type { Point } from "@/lib/document/geometry";
import type { TextElement } from "@/lib/document/schema";
import {
  findElement,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";
import type { EditorStoreApi } from "@/lib/editor/store";
import { selectDocument } from "@/lib/editor/store";
import { cssFamily, getFont, nearestWeight } from "@/lib/fonts/catalog";

const CARET_COLOR = "#2563eb";

// Closes the session's single undo step; text emptied while typing is removed
const finishEditing = (store: EditorStoreApi, id: string) => {
  const state = store.getState();
  const element = findElement(selectDocument(state), id);
  if (element?.type === "text" && element.text.trim() === "") {
    state.change((doc) => removeElements(doc, [id]));
  }
  state.end();
  if (store.getState().editingTextId === id) {
    store.getState().setEditingText(null);
  }
};

export interface TextEditOverlayProps {
  element: TextElement;
  origin: Point;
  zoom: number;
}

// The canvas text stays visible and updates on every keystroke; this
// textarea sits exactly on top as an invisible typing surface (only the
// caret and selection show). Styles are applied imperatively because they
// track zoom/pan and inline style props are off-limits in this codebase.
export const TextEditOverlay = ({
  element,
  origin,
  zoom,
}: TextEditOverlayProps) => {
  const store = useEditorStoreApi();
  const ref = useRef<HTMLTextAreaElement>(null);
  const settledRef = useRef(false);
  const [value, setValue] = useState(element.text);
  const { id } = element;

  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One transaction for the whole editing session. React StrictMode (dev)
  // unmounts and remounts effects once; the deferred finish lets that
  // simulated remount cancel it instead of ending the edit immediately.
  useEffect(() => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    } else {
      store.getState().begin();
    }
    const textarea = ref.current;
    textarea?.focus();
    textarea?.select();
    return () => {
      // Ending the edit any other way (export, clicking a panel) keeps it
      if (!settledRef.current) {
        finishTimerRef.current = setTimeout(() => {
          finishTimerRef.current = null;
          finishEditing(store, id);
        }, 0);
      }
    };
  }, [store, id]);

  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) {
      return;
    }
    const font = getFont(element.fontId);
    const fontSize = element.fontSize * zoom;
    const { style } = textarea;
    style.left = `${origin.x + element.x * zoom}px`;
    style.top = `${origin.y + element.y * zoom}px`;
    style.width = `${element.width * zoom}px`;
    style.transform = `rotate(${element.rotation}deg)`;
    style.fontFamily = cssFamily(font);
    style.fontWeight = String(nearestWeight(font, element.weight));
    style.fontStyle = element.italic && font.italic ? "italic" : "normal";
    style.fontSize = `${fontSize}px`;
    style.lineHeight = String(element.lineHeight);
    style.letterSpacing = `${element.letterSpacingEm * fontSize}px`;
    style.textAlign = element.align;
    style.textTransform = element.uppercase ? "uppercase" : "none";
    style.color = "transparent";
    style.caretColor = CARET_COLOR;
    style.height = "auto";
    style.height = `${textarea.scrollHeight}px`;
  });

  const settle = (cancel: boolean) => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    if (cancel) {
      store.getState().rollback();
      store.getState().setEditingText(null);
      return;
    }
    finishEditing(store, id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      settle(true);
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      settle(false);
    }
  };

  return (
    <textarea
      ref={ref}
      aria-label="Edit text"
      className="selection:bg-primary/25 absolute z-20 m-0 origin-top-left resize-none overflow-hidden border-0 bg-transparent p-0 break-words whitespace-pre-wrap outline-none"
      value={value}
      spellCheck={false}
      onChange={(event) => {
        const text = event.target.value;
        setValue(text);
        store.getState().change((doc) => updateElement(doc, id, { text }));
      }}
      onBlur={() => settle(false)}
      onKeyDown={handleKeyDown}
    />
  );
};
