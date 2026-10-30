import { describe, expect, it } from "vitest";

import {
  applyChange,
  beginTransaction,
  canRedo,
  canUndo,
  createHistory,
  endTransaction,
  redo,
  undo,
} from "@/lib/editor/history";

interface Doc {
  x: number;
}

const doc = (x: number): Doc => ({ x });

describe("history", () => {
  it("records each standalone change as one step", () => {
    let history = createHistory(doc(0));
    history = applyChange(history, doc(1));
    history = applyChange(history, doc(2));

    expect(history.past.map((entry) => entry.x)).toEqual([0, 1]);
    expect(undo(history).present.x).toBe(1);
    expect(undo(undo(history)).present.x).toBe(0);
  });

  it("collapses a transaction into one step back to the pre-gesture state", () => {
    let history = applyChange(createHistory(doc(0)), doc(10));
    history = beginTransaction(history);
    for (const x of [11, 12, 13, 14]) {
      history = applyChange(history, doc(x));
    }
    history = endTransaction(history);

    expect(history.present.x).toBe(14);
    expect(history.past.map((entry) => entry.x)).toEqual([0, 10]);
    expect(undo(history).present.x).toBe(10);
  });

  it("drops a transaction that changed nothing", () => {
    const start = createHistory(doc(0));
    const history = endTransaction(beginTransaction(start));
    expect(history.past).toHaveLength(0);
    expect(canUndo(history)).toBe(false);
  });

  it("closes an open transaction when undoing mid-gesture", () => {
    let history = beginTransaction(createHistory(doc(0)));
    history = applyChange(history, doc(5));
    expect(canUndo(history)).toBe(true);

    history = undo(history);
    expect(history.present.x).toBe(0);
    expect(history.pending).toBeNull();
    expect(redo(history).present.x).toBe(5);
  });

  it("clears redo after a new change and caps history length", () => {
    let history = createHistory(doc(0));
    history = applyChange(history, doc(1));
    history = undo(history);
    expect(canRedo(history)).toBe(true);

    history = applyChange(history, doc(2));
    expect(canRedo(history)).toBe(false);

    let capped = createHistory(doc(0));
    for (let x = 1; x <= 10; x += 1) {
      capped = applyChange(capped, doc(x), 3);
    }
    expect(capped.past.map((entry) => entry.x)).toEqual([7, 8, 9]);
  });

  it("ignores identity changes", () => {
    const history = createHistory(doc(0));
    expect(applyChange(history, history.present)).toBe(history);
  });
});
