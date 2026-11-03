import type { Point } from "@/lib/document/geometry";

// One magic-eraser session: brush strokes and erases, in order, with an
// undo cursor. Pure; whoever runs the session keeps each erase's pixels as
// a patch (what the changed area looked like before and after) under the id
// its step holds.

// A brush stroke in photo pixels: a round brush dragged through the points
export interface Stroke {
  points: readonly Point[];
  radius: number;
}

export type EraseStep =
  | { kind: "stroke"; stroke: Stroke }
  // The strokes since the last erase, filled; `patch` names its pixels
  | { kind: "erase"; patch: number };

export interface EraseSession {
  steps: readonly EraseStep[];
  // How many steps are applied; the ones after it are there to redo
  cursor: number;
}

export const EMPTY_SESSION: EraseSession = { cursor: 0, steps: [] };

// A new step drops whatever was left to redo
const push = (session: EraseSession, step: EraseStep): EraseSession => ({
  cursor: session.cursor + 1,
  steps: [...session.steps.slice(0, session.cursor), step],
});

export const addStroke = (
  session: EraseSession,
  stroke: Stroke
): EraseSession => push(session, { kind: "stroke", stroke });

export const addErase = (session: EraseSession, patch: number): EraseSession =>
  push(session, { kind: "erase", patch });

export const canUndo = ({ cursor }: EraseSession): boolean => cursor > 0;

export const canRedo = ({ cursor, steps }: EraseSession): boolean =>
  cursor < steps.length;

// Steps back over one stroke or erase; `step` is the one undone, so its
// patch can be taken off the photo
export const undoStep = (
  session: EraseSession
): { session: EraseSession; step: EraseStep | null } =>
  canUndo(session)
    ? {
        session: { ...session, cursor: session.cursor - 1 },
        step: session.steps[session.cursor - 1] ?? null,
      }
    : { session, step: null };

export const redoStep = (
  session: EraseSession
): { session: EraseSession; step: EraseStep | null } =>
  canRedo(session)
    ? {
        session: { ...session, cursor: session.cursor + 1 },
        step: session.steps[session.cursor] ?? null,
      }
    : { session, step: null };

// The strokes painted since the last erase that's still applied: what the
// next erase fills, and what the canvas shows over the photo
export const pendingStrokes = ({ cursor, steps }: EraseSession): Stroke[] => {
  const pending: Stroke[] = [];
  for (const step of steps.slice(0, cursor)) {
    if (step.kind === "erase") {
      pending.length = 0;
    } else {
      pending.push(step.stroke);
    }
  }
  return pending;
};

// The patches applied to the photo now, oldest first; none means the photo
// is as it was
export const appliedPatches = ({ cursor, steps }: EraseSession): number[] =>
  steps
    .slice(0, cursor)
    .flatMap((step) => (step.kind === "erase" ? [step.patch] : []));

// Patches `before` held that `after` can no longer reach, so their pixels
// can go: a new step after an undo drops the erases left to redo
export const droppedPatches = (
  before: EraseSession,
  after: EraseSession
): number[] => {
  const kept = new Set(
    after.steps.flatMap((step) => (step.kind === "erase" ? [step.patch] : []))
  );
  return before.steps.flatMap((step) =>
    step.kind === "erase" && !kept.has(step.patch) ? [step.patch] : []
  );
};
