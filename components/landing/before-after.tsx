"use client";

import { useState } from "react";

// Two pictures of the same size, one over the other: dragging the slider
// (or its arrow keys) moves the line between them. Both are blob URLs.
export const BeforeAfter = ({
  after,
  afterLabel,
  before,
  beforeLabel,
}: {
  after: string;
  afterLabel: string;
  before: string;
  beforeLabel: string;
}) => {
  // How far across the line is, in percent
  const [split, setSplit] = useState(50);

  return (
    <div className="relative size-full" style={{ "--split": `${split}%` }}>
      {/* oxlint-disable-next-line nextjs/no-img-element -- a blob URL */}
      <img
        src={before}
        alt={beforeLabel}
        className="absolute inset-0 size-full object-contain"
      />
      {/* oxlint-disable-next-line nextjs/no-img-element -- a blob URL */}
      <img
        src={after}
        alt={afterLabel}
        className="absolute inset-0 size-full object-contain [clip-path:inset(0_0_0_var(--split))]"
      />
      {/* The slider covers the box, unseen; the line shows where it is */}
      <input
        type="range"
        min={0}
        max={100}
        value={split}
        aria-label="Line between before and after"
        aria-valuetext={`${split}% from the left`}
        onChange={(event) => setSplit(Number(event.target.value))}
        className="peer absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
      <div
        aria-hidden
        className="bg-background peer-focus-visible:ring-ring pointer-events-none absolute inset-y-0 left-(--split) w-0.5 -translate-x-1/2 shadow-md peer-focus-visible:w-1 peer-focus-visible:ring-2"
      />
      <span
        aria-hidden
        className="bg-background/80 pointer-events-none absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-medium backdrop-blur"
      >
        Before
      </span>
      <span
        aria-hidden
        className="bg-background/80 pointer-events-none absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-medium backdrop-blur"
      >
        After
      </span>
    </div>
  );
};
