import { describe, expect, it } from "vitest";

import { EMPTY_CHANGES } from "@/lib/collab/changeset";
import type { ChangeSet, Entry } from "@/lib/collab/changeset";
import { createBoxElement } from "@/lib/document/factories";
import {
  beginTransaction,
  canRedo,
  cancelTransaction,
  canUndo,
  createHistory,
  endTransaction,
  recordChange,
  redo,
  undo,
} from "@/lib/editor/history";

const PAGE = { height: 720, width: 1280 };
const base = createBoxElement("rect", PAGE);

const at = (x: number): Entry => ({
  element: { ...base, x },
  position: "a0",
});

// One element moving from x = from to x = to
const move = (from: number, to: number): ChangeSet => ({
  elements: new Map([[base.id, { after: at(to), before: at(from) }]]),
  page: null,
});

const xs = (steps: ChangeSet[]) =>
  steps.map((step) => {
    const change = step.elements.get(base.id);
    return [change?.before?.element.x, change?.after?.element.x];
  });

describe("history", () => {
  it("records each standalone change as one step", () => {
    let history = createHistory();
    history = recordChange(history, move(0, 1));
    history = recordChange(history, move(1, 2));
    expect(xs(history.past)).toEqual([
      [0, 1],
      [1, 2],
    ]);

    const first = undo(history);
    expect(xs([first.step ?? EMPTY_CHANGES])).toEqual([[1, 2]]);
    expect(xs([undo(first.history).step ?? EMPTY_CHANGES])).toEqual([[0, 1]]);
  });

  it("collapses a transaction into one step from the pre-gesture state", () => {
    let history = beginTransaction(createHistory());
    for (const x of [1, 2, 3]) {
      history = recordChange(history, move(x - 1, x));
    }
    history = endTransaction(history);

    expect(xs(history.past)).toEqual([[0, 3]]);
    expect(history.open).toBeNull();
  });

  it("hands back a cancelled transaction instead of recording it", () => {
    let history = recordChange(createHistory(), move(0, 1));
    history = beginTransaction(history);
    history = recordChange(history, move(1, 2));
    history = recordChange(history, move(2, 3));

    const { history: after, reverted } = cancelTransaction(history);
    expect(xs([reverted ?? EMPTY_CHANGES])).toEqual([[1, 3]]);
    expect(after.open).toBeNull();
    expect(xs(after.past)).toEqual([[0, 1]]);
  });

  it("drops a transaction that changed nothing", () => {
    const history = endTransaction(beginTransaction(createHistory()));
    expect(history.past).toHaveLength(0);
    expect(canUndo(history)).toBe(false);
  });

  it("closes an open transaction when undoing mid-gesture", () => {
    let history = beginTransaction(createHistory());
    history = recordChange(history, move(0, 5));
    expect(canUndo(history)).toBe(true);

    const undone = undo(history);
    expect(xs([undone.step ?? EMPTY_CHANGES])).toEqual([[0, 5]]);
    expect(undone.history.open).toBeNull();
    expect(xs([redo(undone.history).step ?? EMPTY_CHANGES])).toEqual([[0, 5]]);
  });

  it("clears redo after a new change and caps history length", () => {
    let history = recordChange(createHistory(), move(0, 1));
    ({ history } = undo(history));
    expect(canRedo(history)).toBe(true);
    history = recordChange(history, move(0, 2));
    expect(canRedo(history)).toBe(false);

    let capped = createHistory();
    for (let x = 1; x <= 10; x += 1) {
      capped = recordChange(capped, move(x - 1, x), 3);
    }
    expect(xs(capped.past)).toEqual([
      [7, 8],
      [8, 9],
      [9, 10],
    ]);
  });

  it("ignores empty change sets", () => {
    const history = createHistory();
    expect(recordChange(history, EMPTY_CHANGES)).toBe(history);
  });
});
