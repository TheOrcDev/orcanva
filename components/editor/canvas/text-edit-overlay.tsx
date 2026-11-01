"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import type { Point } from "@/lib/document/geometry";
import type { TextElement, TextMark } from "@/lib/document/schema";
import {
  findElement,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";
import type { ElementPatch } from "@/lib/editor/document-ops";
import type { EditorStoreApi } from "@/lib/editor/store";
import { selectDocument } from "@/lib/editor/store";
import {
  FALLBACK_FAMILIES,
  cssFamily,
  getFont,
  nearestWeight,
} from "@/lib/fonts/catalog";
import { isFontReady } from "@/lib/fonts/loader";
import { selectRange, selectionIn } from "@/lib/text/dom-text";
import type { TextRange } from "@/lib/text/dom-text";
import { rebaseMarks, styledSegments } from "@/lib/text/marks";
import { toggleBold, toggleStyle } from "@/lib/text/text-style";

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

const currentText = (store: EditorStoreApi, id: string) => {
  const element = findElement(selectDocument(store.getState()), id);
  return element?.type === "text" ? element : undefined;
};

// CSS for one run, matching how the canvas draws it (in screen pixels)
const runStyle = (
  element: TextElement,
  style: Omit<TextMark, "start" | "end">,
  zoom: number
): Partial<CSSStyleDeclaration> => {
  const font = getFont(style.fontId ?? element.fontId);
  const weight = nearestWeight(font, style.weight ?? element.weight);
  const italic = (style.italic ?? element.italic) && font.italic;
  const fontSize = element.fontSize * (style.sizeEm ?? 1) * zoom;
  const ready = isFontReady({ fontId: font.id, italic, text: "", weight });
  return {
    fontFamily: ready ? cssFamily(font) : FALLBACK_FAMILIES[font.category],
    fontSize: `${fontSize}px`,
    fontStyle: italic ? "italic" : "normal",
    fontWeight: String(weight),
    letterSpacing: `${element.letterSpacingEm * fontSize}px`,
  };
};

// One span per styled run, so the browser lays the characters out like
// the canvas does and the caret and selection sit on them
const renderRuns = (root: HTMLElement, element: TextElement, zoom: number) => {
  const spans = styledSegments(element.text, element.marks).map((segment) => {
    const span = document.createElement("span");
    Object.assign(span.style, runStyle(element, segment.style, zoom));
    span.textContent = segment.text;
    return span;
  });
  root.replaceChildren(...spans);
};

// Plain text only: styles come from the text, not from where it was copied
const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
  event.preventDefault();
  const text = event.clipboardData.getData("text/plain");
  document.execCommand("insertText", false, text);
};

// What one undo step inside the edit puts back
interface Snapshot {
  text: string;
  marks: TextMark[];
  selection: TextRange | null;
}

export interface TextEditOverlayProps {
  element: TextElement;
  origin: Point;
  zoom: number;
}

// An editable element laid exactly over the canvas text: the canvas keeps
// drawing the text on every keystroke while this only shows the caret and
// selection (its own text is transparent). Typing is the browser's, so input
// methods, spellcheck and selection all work; each input reads the text back
// and moves the marks along with it. The text panel styles the selected
// characters, which are kept in the store while it has focus.
export const TextEditOverlay = ({
  element,
  origin,
  zoom,
}: TextEditOverlayProps) => {
  const store = useEditorStoreApi();
  const ref = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The text and marks the spans show; anything else came from outside
  // (the panel, undo) and redraws them
  const shownRef = useRef<{ text: string; marks: TextMark[] } | null>(null);
  const undoRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const { id } = element;
  // Everything starts selected, as when the edit began
  const initialLengthRef = useRef(element.text.length);

  // One transaction for the whole editing session. React StrictMode (dev)
  // unmounts and remounts effects once; the deferred finish lets that
  // simulated remount cancel it instead of ending the edit immediately.
  useEffect(() => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    } else {
      store.getState().begin();
      const root = ref.current;
      if (root) {
        root.focus();
        selectRange(root, { end: initialLengthRef.current, start: 0 });
      }
    }
    return () => {
      // Ending the edit any other way (pressing the canvas, export) keeps it
      if (!settledRef.current) {
        finishTimerRef.current = setTimeout(() => {
          finishTimerRef.current = null;
          finishEditing(store, id);
        }, 0);
      }
    };
  }, [store, id]);

  // Draws the spans when the text or marks changed from outside, keeping the
  // selection where it was
  useLayoutEffect(() => {
    const root = ref.current;
    const shown = shownRef.current;
    if (
      !root ||
      (shown?.text === element.text && shown.marks === element.marks)
    ) {
      return;
    }
    const focused = document.activeElement === root;
    const selection = focused
      ? selectionIn(root)
      : store.getState().textSelection;
    renderRuns(root, element, zoom);
    shownRef.current = { marks: element.marks, text: element.text };
    if (focused && selection) {
      selectRange(root, selection);
    }
  });

  // Position and the text's own style, following zoom and pan. Applied
  // imperatively because inline style props are off-limits here.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) {
      return;
    }
    const { style } = root;
    style.left = `${origin.x + element.x * zoom}px`;
    style.top = `${origin.y + element.y * zoom}px`;
    style.width = `${element.width * zoom}px`;
    style.transform = `rotate(${element.rotation}deg)`;
    Object.assign(style, runStyle(element, {}, zoom));
    style.lineHeight = String(element.lineHeight);
    style.textAlign = element.align;
    style.textTransform = element.uppercase ? "uppercase" : "none";
    style.color = "transparent";
    style.caretColor = CARET_COLOR;
    // Spans keep their own sizes when zoom changes
    for (const [index, segment] of styledSegments(
      element.text,
      element.marks
    ).entries()) {
      const span = root.children[index];
      if (span instanceof HTMLElement) {
        Object.assign(span.style, runStyle(element, segment.style, zoom));
      }
    }
  });

  // Keeps the selected characters in the store for the panel's controls
  useEffect(() => {
    const track = () => {
      const root = ref.current;
      const selection = root ? selectionIn(root) : null;
      if (selection) {
        store.getState().setTextSelection(selection);
      }
    };
    document.addEventListener("selectionchange", track);
    return () => document.removeEventListener("selectionchange", track);
  }, [store]);

  const snapshot = (): Snapshot | null => {
    const current = currentText(store, id);
    const root = ref.current;
    return current
      ? {
          marks: current.marks,
          selection: root ? selectionIn(root) : null,
          text: current.text,
        }
      : null;
  };

  const apply = (patch: ElementPatch, before: Snapshot | null) => {
    if (before) {
      undoRef.current.push(before);
      redoRef.current = [];
    }
    store.getState().change((doc) => updateElement(doc, id, patch));
  };

  const restore = (to: Snapshot) => {
    store
      .getState()
      .change((doc) =>
        updateElement(doc, id, { marks: to.marks, text: to.text })
      );
    const root = ref.current;
    const now = currentText(store, id);
    if (root && now) {
      renderRuns(root, now, zoom);
      shownRef.current = { marks: now.marks, text: now.text };
      if (to.selection) {
        selectRange(root, to.selection);
      }
    }
  };

  const handleInput = () => {
    const root = ref.current;
    const current = currentText(store, id);
    if (!(root && current)) {
      return;
    }
    const text = root.textContent ?? "";
    const marks = rebaseMarks(current.text, text, current.marks);
    shownRef.current = { marks, text };
    undoRef.current.push({
      marks: current.marks,
      selection: null,
      text: current.text,
    });
    redoRef.current = [];
    store.getState().change((doc) => updateElement(doc, id, { marks, text }));
  };

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

  const styleSelection = (
    toggle: (element: TextElement, range: TextRange | null) => ElementPatch
  ) => {
    const root = ref.current;
    const current = currentText(store, id);
    if (!(root && current)) {
      return;
    }
    apply(toggle(current, selectionIn(root)), snapshot());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (event.key === "Escape") {
      settle(true);
    } else if (event.key === "Enter" && modifier) {
      event.preventDefault();
      settle(false);
    } else if (event.key === "Enter") {
      // A plain line break, not a new block
      event.preventDefault();
      document.execCommand("insertText", false, "\n");
    } else if (modifier && key === "b") {
      event.preventDefault();
      styleSelection(toggleBold);
    } else if (modifier && key === "i") {
      event.preventDefault();
      styleSelection((current, range) => toggleStyle(current, range, "italic"));
    } else if (modifier && key === "u") {
      event.preventDefault();
      styleSelection((current, range) =>
        toggleStyle(current, range, "underline")
      );
    } else if (modifier && key === "z") {
      // Undo inside the edit; the whole edit is one step afterwards
      event.preventDefault();
      const from = event.shiftKey ? redoRef.current : undoRef.current;
      const to = event.shiftKey ? undoRef.current : redoRef.current;
      const step = from.pop();
      const now = snapshot();
      if (step && now) {
        to.push(now);
        restore(step);
      }
    }
  };

  return (
    <div
      ref={ref}
      // A textarea can't hold runs in different fonts and sizes, so this is
      // an editable element in the textbox role
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="textbox"
      tabIndex={0}
      aria-label="Edit text"
      aria-multiline
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      className="selection:bg-primary/25 absolute z-20 m-0 origin-top-left overflow-visible border-0 bg-transparent p-0 break-words whitespace-pre-wrap outline-none"
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    />
  );
};
