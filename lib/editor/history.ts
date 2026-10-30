// Undo/redo over immutable snapshots. A transaction (begin → transient
// changes → end) collapses a drag, slider scrub, or typing burst into a
// single undo step whose "before" is the state when the transaction began.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  // Snapshot taken at begin(); null when no transaction is open
  pending: T | null;
}

export const HISTORY_LIMIT = 100;

export const createHistory = <T>(present: T): History<T> => ({
  future: [],
  past: [],
  pending: null,
  present,
});

const pushPast = <T>(past: T[], entry: T, limit: number): T[] => {
  const next = [...past, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
};

export const isInTransaction = <T>(history: History<T>): boolean =>
  history.pending !== null;

export const beginTransaction = <T>(history: History<T>): History<T> =>
  history.pending === null ? { ...history, pending: history.present } : history;

export const endTransaction = <T>(
  history: History<T>,
  limit = HISTORY_LIMIT
): History<T> => {
  if (history.pending === null) {
    return history;
  }
  if (history.pending === history.present) {
    return { ...history, pending: null };
  }
  return {
    future: [],
    past: pushPast(history.past, history.pending, limit),
    pending: null,
    present: history.present,
  };
};

// Inside a transaction the change is transient; otherwise it is one step
export const applyChange = <T>(
  history: History<T>,
  next: T,
  limit = HISTORY_LIMIT
): History<T> => {
  if (next === history.present) {
    return history;
  }
  if (history.pending !== null) {
    return { ...history, present: next };
  }
  return {
    future: [],
    past: pushPast(history.past, history.present, limit),
    pending: null,
    present: next,
  };
};

export const canUndo = <T>(history: History<T>): boolean =>
  history.past.length > 0 ||
  (history.pending !== null && history.pending !== history.present);

export const canRedo = <T>(history: History<T>): boolean =>
  history.future.length > 0;

export const undo = <T>(history: History<T>): History<T> => {
  const settled = endTransaction(history);
  const previous = settled.past.at(-1);
  if (previous === undefined) {
    return settled;
  }
  return {
    future: [settled.present, ...settled.future],
    past: settled.past.slice(0, -1),
    pending: null,
    present: previous,
  };
};

export const redo = <T>(history: History<T>): History<T> => {
  const settled = endTransaction(history);
  const [next, ...rest] = settled.future;
  if (next === undefined) {
    return settled;
  }
  return {
    future: rest,
    past: [...settled.past, settled.present],
    pending: null,
    present: next,
  };
};
