import { describe, expect, it } from "vitest";

import {
  EMPTY_SESSION,
  addErase,
  addStroke,
  appliedPatches,
  canRedo,
  canUndo,
  droppedPatches,
  pendingStrokes,
  redoStep,
  undoStep,
} from "@/lib/magic-eraser/session";
import type { EraseSession, Stroke } from "@/lib/magic-eraser/session";

const stroke = (x: number): Stroke => ({ points: [{ x, y: 0 }], radius: 10 });

// Stroke A, stroke B, erase 1, stroke C
const painted = (): EraseSession =>
  addStroke(
    addErase(addStroke(addStroke(EMPTY_SESSION, stroke(1)), stroke(2)), 1),
    stroke(3)
  );

describe("erase session", () => {
  it("shows the strokes painted since the last erase", () => {
    const session = painted();
    expect(pendingStrokes(session)).toEqual([stroke(3)]);
    expect(appliedPatches(session)).toEqual([1]);
  });

  it("undoes strokes and erases one at a time", () => {
    let { session, step } = undoStep(painted());
    expect(step).toEqual({ kind: "stroke", stroke: stroke(3) });
    expect(pendingStrokes(session)).toEqual([]);

    ({ session, step } = undoStep(session));
    // Undoing the erase brings back the strokes it filled
    expect(step).toEqual({ kind: "erase", patch: 1 });
    expect(pendingStrokes(session)).toEqual([stroke(1), stroke(2)]);
    expect(appliedPatches(session)).toEqual([]);

    ({ session, step } = redoStep(session));
    expect(step).toEqual({ kind: "erase", patch: 1 });
    expect(appliedPatches(session)).toEqual([1]);
    expect(canRedo(session)).toBe(true);
  });

  it("does nothing past either end", () => {
    expect(undoStep(EMPTY_SESSION)).toEqual({
      session: EMPTY_SESSION,
      step: null,
    });
    expect(canUndo(EMPTY_SESSION)).toBe(false);
    const session = painted();
    expect(redoStep(session)).toEqual({ session, step: null });
  });

  it("drops what was left to redo when something new is painted", () => {
    const before = undoStep(undoStep(painted()).session).session;
    const after = addStroke(before, stroke(4));
    expect(canRedo(after)).toBe(false);
    expect(after.steps).toHaveLength(3);
    expect(pendingStrokes(after)).toEqual([stroke(1), stroke(2), stroke(4)]);
    // The erase can't be redone any more, so its pixels can go
    expect(droppedPatches(before, after)).toEqual([1]);
    expect(droppedPatches(painted(), addStroke(painted(), stroke(5)))).toEqual(
      []
    );
  });
});
