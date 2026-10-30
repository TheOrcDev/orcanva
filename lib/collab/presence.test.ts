import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  initials,
  parseProfile,
  randomProfile,
  PROFILE_COLORS,
} from "@/lib/collab/identity";
import {
  createPresenceSender,
  peersFromRows,
  PRESENCE_STALE_MS,
} from "@/lib/collab/presence";
import type { LivePresenceRow, PresenceState } from "@/lib/collab/presence";

const NOW = Date.UTC(2026, 9, 30, 12);

const row = (overrides: Partial<LivePresenceRow>): LivePresenceRow => ({
  client_id: "peer",
  color: "#e5484d",
  drag: null,
  image: null,
  name: "Grom",
  seen_at: new Date(NOW - 1000),
  selection: [],
  x: 10,
  y: 20,
  ...overrides,
});

describe("peersFromRows", () => {
  it("lists others seen recently, without this session", () => {
    const peers = peersFromRows(
      [
        row({ client_id: "me" }),
        row({ client_id: "b", name: "Thrall" }),
        row({ client_id: "a", name: "Durotan", x: null }),
        row({
          client_id: "gone",
          seen_at: new Date(NOW - PRESENCE_STALE_MS - 1),
        }),
      ],
      "me",
      NOW
    );
    expect(peers.map((peer) => peer.name)).toEqual(["Durotan", "Thrall"]);
    expect(peers[0]?.cursor).toBeNull();
    expect(peers[1]?.cursor).toEqual({ x: 10, y: 20 });
  });

  it("keeps https avatars only", () => {
    const peers = peersFromRows(
      [
        row({ client_id: "a", image: "https://lh3.example.com/a.png" }),
        row({ client_id: "b", image: "http://insecure.example/b.png" }),
      ],
      "me",
      NOW
    );
    expect(peers.map((peer) => peer.image)).toEqual([
      "https://lh3.example.com/a.png",
      null,
    ]);
  });

  it("ignores malformed selection and drag data", () => {
    const [peer] = peersFromRows(
      [row({ drag: { elementId: "" }, selection: "nope" })],
      "me",
      NOW
    );
    expect(peer?.selection).toEqual([]);
    expect(peer?.drag).toBeNull();
  });
});

describe("createPresenceSender", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const initial: PresenceState = {
    color: "#e5484d",
    drag: null,
    name: "Grom",
    selection: [],
    x: null,
    y: null,
  };

  it("sends at most once per interval, skipping to the latest state", async () => {
    const sent: (number | null)[] = [];
    const sender = createPresenceSender({
      heartbeatMs: 60_000,
      initial,
      intervalMs: 100,
      send: (state) => {
        sent.push(state.x);
        return Promise.resolve();
      },
    });
    await vi.advanceTimersByTimeAsync(10);
    for (const x of [1, 2, 3, 4]) {
      sender.update({ x, y: 0 });
    }
    await vi.advanceTimersByTimeAsync(150);
    sender.dispose();

    expect(sent).toEqual([null, 4]);
  });

  it("heartbeats while idle", async () => {
    let count = 0;
    const sender = createPresenceSender({
      heartbeatMs: 1000,
      initial,
      intervalMs: 100,
      send: () => {
        count += 1;
        return Promise.resolve();
      },
    });
    await vi.advanceTimersByTimeAsync(3150);
    sender.dispose();
    expect(count).toBe(4);
  });
});

describe("identity", () => {
  it("makes a valid random profile", () => {
    const profile = randomProfile(() => 0.5);
    expect(PROFILE_COLORS).toContain(profile.color);
    expect(profile.name.split(" ")).toHaveLength(2);
  });

  it("only accepts well-formed saved profiles", () => {
    expect(parseProfile('{"name":"Grom","color":"#e5484d"}')).toEqual({
      color: "#e5484d",
      name: "Grom",
    });
    expect(parseProfile('{"name":"","color":"#e5484d"}')).toBeNull();
    expect(parseProfile("not json")).toBeNull();
    expect(parseProfile(null)).toBeNull();
  });

  it("abbreviates names for avatars", () => {
    expect(initials("Mighty Thrall")).toBe("MT");
    expect(initials("grom")).toBe("GR");
  });
});
