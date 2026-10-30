import { describe, expect, it } from "vitest";

import { assignPositions, comparePositioned } from "@/lib/collab/positions";

const keysIn = (positions: Map<string, string>, order: string[]) =>
  order.map((id) => positions.get(id) ?? "");

const isStrictlyIncreasing = (keys: string[]) =>
  keys.every((key, index) => index === 0 || (keys[index - 1] ?? "") < key);

describe("assignPositions", () => {
  it("gives fresh, increasing keys when there are none", () => {
    const positions = assignPositions(new Map(), ["a", "b", "c"]);
    expect(isStrictlyIncreasing(keysIn(positions, ["a", "b", "c"]))).toBe(true);
  });

  it("keeps every key when the order is unchanged", () => {
    const previous = new Map([
      ["a", "a0"],
      ["b", "a1"],
      ["c", "a2"],
    ]);
    expect(assignPositions(previous, ["a", "b", "c"])).toEqual(previous);
  });

  it("rewrites only the element that moved", () => {
    const previous = new Map([
      ["a", "a0"],
      ["b", "a1"],
      ["c", "a2"],
      ["d", "a3"],
    ]);
    // Bring "a" to the front (top of the stack)
    const positions = assignPositions(previous, ["b", "c", "d", "a"]);

    expect(positions.get("b")).toBe("a1");
    expect(positions.get("c")).toBe("a2");
    expect(positions.get("d")).toBe("a3");
    expect((positions.get("a") ?? "") > "a3").toBe(true);
  });

  it("slots a new element between its neighbours", () => {
    const previous = new Map([
      ["a", "a0"],
      ["c", "a1"],
    ]);
    const positions = assignPositions(previous, ["a", "b", "c"]);

    expect(positions.get("a")).toBe("a0");
    expect(positions.get("c")).toBe("a1");
    expect(isStrictlyIncreasing(keysIn(positions, ["a", "b", "c"]))).toBe(true);
  });

  it("separates equal keys from concurrent inserts", () => {
    const previous = new Map([
      ["a", "a0"],
      ["b", "a1"],
      ["c", "a1"],
    ]);
    const positions = assignPositions(previous, ["a", "b", "c"]);
    expect(isStrictlyIncreasing(keysIn(positions, ["a", "b", "c"]))).toBe(true);
  });

  it("always produces the requested order", () => {
    const ids = Array.from({ length: 12 }, (_, index) => `e${index}`);
    let positions = assignPositions(new Map(), ids);
    let order = ids;
    // Deterministic shuffles: rotate and reverse slices
    for (let round = 1; round <= 20; round += 1) {
      const cut = (round * 5) % order.length;
      order = [...order.slice(cut), ...order.slice(0, cut).toReversed()];
      positions = assignPositions(positions, order);
      expect(isStrictlyIncreasing(keysIn(positions, order))).toBe(true);
    }
  });
});

describe("comparePositioned", () => {
  it("sorts by key, then by id", () => {
    const sorted = [
      { id: "b", position: "a1" },
      { id: "a", position: "a1" },
      { id: "c", position: "a0" },
    ].toSorted(comparePositioned);
    expect(sorted.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });
});
