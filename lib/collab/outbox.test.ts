import { describe, expect, it } from "vitest";

import type { Entry } from "@/lib/collab/changeset";
import { buildBatch, createOutbox, SaveError } from "@/lib/collab/outbox";
import type {
  ChangesRequest,
  OutboxHost,
  SaveStatus,
} from "@/lib/collab/outbox";
import {
  EMPTY_PENDING,
  addWrites,
  dropBatch,
  settleBatch,
} from "@/lib/collab/sync-state";
import type { PendingWrites, SyncedState } from "@/lib/collab/sync-state";
import { createBoxElement, createDocument } from "@/lib/document/factories";

const PAGE = { height: 720, width: 1280 };
const { background, height, width } = createDocument(PAGE);

const entry = (id: string, x: number): Entry => ({
  element: { ...createBoxElement("rect", PAGE), id, x },
  position: "a0",
});

// A minimal host that keeps pending/synced state the way the store does
const setup = () => {
  let pending: PendingWrites = EMPTY_PENDING;
  let synced: SyncedState = {
    elements: new Map(),
    name: "Name",
    page: { background, height, width },
  };
  let seq = 0;
  const statuses: SaveStatus[] = [];
  const settled: boolean[] = [];
  const host: OutboxHost = {
    clientId: "00000000-0000-4000-8000-000000000000",
    designId: "design",
    drop: (batch) => {
      pending = dropBatch(pending, batch);
    },
    getPending: () => pending,
    setStatus: (status) => statuses.push(status),
    settle: (batch, promote) => {
      settled.push(promote);
      ({ pending, synced } = settleBatch(pending, synced, batch, promote));
    },
  };
  const write = (id: string, x: number) => {
    seq += 1;
    pending = addWrites(
      pending,
      { elements: new Map([[id, entry(id, x)]]), page: null },
      new Set(),
      seq
    );
  };
  return {
    getPending: () => pending,
    getSynced: () => synced,
    host,
    settled,
    statuses,
    write,
  };
};

describe("buildBatch", () => {
  it("splits pending writes into upserts, deletes, page and name", () => {
    let pending = addWrites(
      EMPTY_PENDING,
      {
        elements: new Map([
          ["a", entry("a", 1)],
          ["b", null],
        ]),
        page: { background, height: 100, width: 100 },
      },
      new Set(["b"]),
      3
    );
    pending = { ...pending, name: { seq: 4, value: "Renamed" } };
    const { request, seqs } = buildBatch("client", pending);

    expect(request.elements.map((item) => [item.data.id, item.mode])).toEqual([
      ["a", "create"],
    ]);
    expect(request.deletes).toEqual(["b"]);
    expect(request.page?.width).toBe(100);
    expect(request.name).toBe("Renamed");
    expect(seqs).toMatchObject({ name: 4, page: 3 });
  });
});

describe("createOutbox", () => {
  it("sends pending writes and promotes them when nothing echoes back", async () => {
    const { getPending, getSynced, host, settled, write } = setup();
    const sent: ChangesRequest[] = [];
    const outbox = createOutbox(host, (_id, request) => {
      sent.push(request);
      return Promise.resolve({ txid: "1" });
    });
    write("a", 1);
    await outbox.flush();

    expect(sent).toHaveLength(1);
    expect(settled).toEqual([true]);
    expect(getPending().elements.size).toBe(0);
    expect(getSynced().elements.get("a")?.element.x).toBe(1);
  });

  it("waits for the live query instead of promoting when connected", async () => {
    const { host, settled, write } = setup();
    const waited: string[] = [];
    const outbox = createOutbox(host, () => Promise.resolve({ txid: "42" }));
    outbox.setAwaitSync((txid) => {
      waited.push(txid);
      return Promise.resolve(true);
    });
    write("a", 1);
    await outbox.flush();

    expect(waited).toEqual(["42"]);
    expect(settled).toEqual([false]);
  });

  it("keeps one request in flight and sends later edits next", async () => {
    const { getPending, host, write } = setup();
    const sent: number[] = [];
    const gate = Promise.withResolvers<{ txid: string }>();
    const outbox = createOutbox(host, (_id, request) => {
      sent.push(request.elements[0]?.data.x ?? -1);
      return sent.length === 1 ? gate.promise : Promise.resolve({ txid: "2" });
    });
    write("a", 1);
    const first = outbox.flush();
    await Promise.resolve();
    write("a", 2);
    const second = outbox.flush();
    gate.resolve({ txid: "1" });
    await Promise.all([first, second]);

    expect(sent).toEqual([1, 2]);
    expect(getPending().elements.size).toBe(0);
  });

  it("drops a refused batch and keeps a failed one for retry", async () => {
    const refused = setup();
    const outbox = createOutbox(refused.host, () =>
      Promise.reject(new SaveError("Bad request", false))
    );
    refused.write("a", 1);
    await outbox.flush();
    expect(refused.getPending().elements.size).toBe(0);

    const offline = setup();
    const retrying = createOutbox(offline.host, () =>
      Promise.reject(new SaveError("Offline", true))
    );
    offline.write("a", 1);
    await retrying.flush();
    expect(offline.getPending().elements.size).toBe(1);
    expect(offline.statuses.at(-1)).toBe("error");
    retrying.dispose();
  });
});
