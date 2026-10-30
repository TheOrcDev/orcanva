import {
  EMPTY_CHANGES,
  isEmptyChangeSet,
  mergeChangeSets,
} from "@/lib/collab/changeset";
import type { ChangeSet } from "@/lib/collab/changeset";

// Undo/redo as change sets rather than document snapshots, so undoing
// re-applies only your own edits on top of whatever others changed since.
// A transaction (begin → transient changes → end) collapses a drag, slider
// scrub, or typing burst into a single step.
export interface History {
  past: ChangeSet[];
  future: ChangeSet[];
  // Changes collected since begin(); null when no transaction is open
  open: ChangeSet | null;
}

export const HISTORY_LIMIT = 100;

export const createHistory = (): History => ({
  future: [],
  open: null,
  past: [],
});

const pushPast = (
  past: ChangeSet[],
  entry: ChangeSet,
  limit: number
): ChangeSet[] => {
  const next = [...past, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
};

export const isInTransaction = (history: History): boolean =>
  history.open !== null;

export const beginTransaction = (history: History): History =>
  history.open === null ? { ...history, open: EMPTY_CHANGES } : history;

export const endTransaction = (
  history: History,
  limit = HISTORY_LIMIT
): History => {
  if (history.open === null) {
    return history;
  }
  if (isEmptyChangeSet(history.open)) {
    return { ...history, open: null };
  }
  return {
    future: [],
    open: null,
    past: pushPast(history.past, history.open, limit),
  };
};

// Records a local edit: folded into the open transaction, otherwise one step
export const recordChange = (
  history: History,
  changes: ChangeSet,
  limit = HISTORY_LIMIT
): History => {
  if (isEmptyChangeSet(changes)) {
    return history;
  }
  if (history.open !== null) {
    return { ...history, open: mergeChangeSets(history.open, changes) };
  }
  return {
    future: [],
    open: null,
    past: pushPast(history.past, changes, limit),
  };
};

// Abandons the open transaction; the caller reverts what it changed
export const cancelTransaction = (
  history: History
): { history: History; reverted: ChangeSet | null } => {
  if (history.open === null) {
    return { history, reverted: null };
  }
  return {
    history: { ...history, open: null },
    reverted: isEmptyChangeSet(history.open) ? null : history.open,
  };
};

export const canUndo = (history: History): boolean =>
  history.past.length > 0 ||
  (history.open !== null && !isEmptyChangeSet(history.open));

export const canRedo = (history: History): boolean => history.future.length > 0;

// Steps back; `step` is the change set to revert (null when there is none)
export const undo = (
  history: History
): { history: History; step: ChangeSet | null } => {
  const settled = endTransaction(history);
  const step = settled.past.at(-1);
  if (step === undefined) {
    return { history: settled, step: null };
  }
  return {
    history: {
      future: [step, ...settled.future],
      open: null,
      past: settled.past.slice(0, -1),
    },
    step,
  };
};

// Steps forward; `step` is the change set to re-apply
export const redo = (
  history: History
): { history: History; step: ChangeSet | null } => {
  const settled = endTransaction(history);
  const [step, ...rest] = settled.future;
  if (step === undefined) {
    return { history: settled, step: null };
  }
  return {
    history: { future: rest, open: null, past: [...settled.past, step] },
    step,
  };
};
