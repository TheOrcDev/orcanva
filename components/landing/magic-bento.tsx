"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// How far outside the grid the pointer still lights the edges
const NEAR_MARGIN = 150;
// Tiles rise in one after another, this far apart
const STAGGER_MS = 80;
// The ring outruns the farthest corner by this much, so it fades off-grid
const WAVE_OVERSHOOT = 140;
const WAVE_MS = 1100;
const INTRO_WAVE_MS = 1700;
// The intro's ring starts once the first tiles are on their way
const INTRO_WAVE_DELAY_MS = 260;
const WAVE_EASING = "cubic-bezier(0.25, 0.8, 0.4, 1)";
// The grid counts as "in view" for the intro once this much of it shows
const INTRO_THRESHOLD = 0.15;

// After React Bits' Magic Bento. The tiles are server-rendered children
// marked with data-bento-card (see bento-card.tsx); this only tracks the
// pointer and clicks and writes positions as custom properties, and
// app/globals.css draws the light from them.
export const MagicBento = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const rootRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const cards = [...root.querySelectorAll<HTMLElement>("[data-bento-card]")];
    const motion = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const pointer = { x: -1e5, y: -1e5 };
    let bounds = root.getBoundingClientRect();
    let rects = cards.map((card) => card.getBoundingClientRect());
    let dirty = false;
    let frame = 0;
    let visible = false;
    let entered = !motion;
    let introTimer: ReturnType<typeof setTimeout> | undefined;

    const measure = () => {
      if (!dirty) {
        return;
      }
      bounds = root.getBoundingClientRect();
      rects = cards.map((card) => card.getBoundingClientRect());
      dirty = false;
    };

    const paint = () => {
      frame = 0;
      measure();
      const near =
        pointer.x > bounds.left - NEAR_MARGIN &&
        pointer.x < bounds.right + NEAR_MARGIN &&
        pointer.y > bounds.top - NEAR_MARGIN &&
        pointer.y < bounds.bottom + NEAR_MARGIN;
      root.toggleAttribute("data-near", near);
      for (const [index, card] of cards.entries()) {
        const rect = rects[index];
        if (rect) {
          card.style.setProperty("--bento-x", `${pointer.x - rect.left}px`);
          card.style.setProperty("--bento-y", `${pointer.y - rect.top}px`);
        }
      }
    };

    const schedule = () => {
      if (visible && !frame) {
        frame = requestAnimationFrame(paint);
      }
    };

    // A ring of light from (x, y) across every tile
    const wave = (x: number, y: number, duration: number) => {
      if (!motion) {
        return;
      }
      measure();
      const reach =
        Math.max(
          Math.hypot(x - bounds.left, y - bounds.top),
          Math.hypot(x - bounds.right, y - bounds.top),
          Math.hypot(x - bounds.left, y - bounds.bottom),
          Math.hypot(x - bounds.right, y - bounds.bottom)
        ) + WAVE_OVERSHOOT;
      root.style.setProperty("--bento-reach", `${reach}px`);
      for (const [index, card] of cards.entries()) {
        const rect = rects[index];
        if (rect) {
          card.style.setProperty("--bento-wx", `${x - rect.left}px`);
          card.style.setProperty("--bento-wy", `${y - rect.top}px`);
        }
      }
      root.animate(
        { "--bento-wave": [0, 1] },
        { duration, easing: WAVE_EASING }
      );
    };

    const enter = () => {
      entered = true;
      for (const [index, card] of cards.entries()) {
        card.style.setProperty("--bento-delay", `${index * STAGGER_MS}ms`);
      }
      root.toggleAttribute("data-entered", true);
      introTimer = setTimeout(() => {
        dirty = true;
        measure();
        wave(bounds.left, bounds.top, INTRO_WAVE_MS);
      }, INTRO_WAVE_DELAY_MS);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      schedule();
    };

    // Leaving the window: let the edge light fade out
    const onPointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) {
        pointer.x = -1e5;
        pointer.y = -1e5;
        schedule();
      }
    };

    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a")) {
        return;
      }
      wave(event.clientX, event.clientY, WAVE_MS);
    };

    // Scrolling moves the tiles under a still pointer
    const onLayout = () => {
      dirty = true;
      schedule();
    };

    // Tiles are measured mid-intro too, so measure again once they land
    const onSettle = (event: TransitionEvent) => {
      if (event.propertyName === "translate") {
        onLayout();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }
        visible = entry.isIntersecting;
        if (visible) {
          onLayout();
        }
        if (!entered && entry.intersectionRatio >= INTRO_THRESHOLD) {
          enter();
        }
      },
      { threshold: [0, INTRO_THRESHOLD] }
    );
    const resizeObserver = new ResizeObserver(onLayout);

    root.toggleAttribute("data-intro", motion);
    observer.observe(root);
    resizeObserver.observe(root);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onLayout, { passive: true });
    document.addEventListener("pointerout", onPointerOut);
    root.addEventListener("click", onClick);
    root.addEventListener("transitionend", onSettle);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(introTimer);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onLayout);
      document.removeEventListener("pointerout", onPointerOut);
      root.removeEventListener("click", onClick);
      root.removeEventListener("transitionend", onSettle);
    };
  }, []);

  return (
    <ul ref={rootRef} className={cn("bento", className)}>
      {children}
    </ul>
  );
};
