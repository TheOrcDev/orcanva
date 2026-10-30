"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { Point } from "@/lib/document/geometry";
import type { TextElement } from "@/lib/document/schema";
import { cssFamily, getFont, nearestWeight } from "@/lib/fonts/catalog";

export interface TextEditOverlayProps {
  element: TextElement;
  origin: Point;
  zoom: number;
  onCommit: (id: string, text: string) => void;
  onCancel: () => void;
}

// A textarea laid exactly over the (hidden) Konva text. Styles are applied
// imperatively: they track zoom/pan every frame and inline style props are
// off-limits in this codebase.
export const TextEditOverlay = ({
  element,
  origin,
  zoom,
  onCommit,
  onCancel,
}: TextEditOverlayProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(element.text);
  const valueRef = useRef(value);
  const settledRef = useRef(false);
  const commitRef = useRef(onCommit);

  useLayoutEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);

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
    style.color = element.fill;
    style.textTransform = element.uppercase ? "uppercase" : "none";
    style.height = "auto";
    style.height = `${textarea.scrollHeight}px`;
  });

  useEffect(() => {
    const textarea = ref.current;
    textarea?.focus();
    textarea?.select();
    // Ending the edit any other way (export, undo, selecting elsewhere)
    // still keeps what was typed
    return () => {
      if (!settledRef.current) {
        commitRef.current(element.id, valueRef.current);
      }
    };
  }, [element.id]);

  const commit = () => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    onCommit(element.id, valueRef.current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      settledRef.current = true;
      onCancel();
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      commit();
    }
  };

  return (
    <textarea
      ref={ref}
      aria-label="Edit text"
      className="absolute z-20 m-0 origin-top-left resize-none overflow-hidden border-0 bg-transparent p-0 break-words whitespace-pre-wrap outline-none"
      value={value}
      spellCheck={false}
      onChange={(event) => {
        valueRef.current = event.target.value;
        setValue(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  );
};
