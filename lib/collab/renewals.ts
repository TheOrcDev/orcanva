// Each live query renews its sealed query on its own, shortly before it
// expires (about once a minute). Asking for all of them in one request
// instead saves a session check and a role query per query: one request a
// minute per editor rather than one per query.
//
// The queries are sealed together, so they expire together and ask within
// a few milliseconds of each other: requests that arrive within `windowMs`
// share one. A request always asks for every query, and the ones nobody
// asked for yet are kept, so a query that asks a little later (after a
// retry, say) takes the kept one rather than starting another request, as
// long as it's younger than `reuseMs`. Each kept one is handed out once.

// Long enough for timers set the same moment to all fire, short enough
// that nothing waits noticeably
export const RENEWAL_WINDOW_MS = 250;

// Sealed queries last a minute and are renewed 10 seconds before they
// expire: one kept for up to 20 seconds still has 30 seconds or more left
export const RENEWAL_REUSE_MS = 20_000;

export interface RenewalBatcher<Sealed extends object> {
  // A freshly sealed query for one live query
  renew: <Name extends keyof Sealed & string>(
    name: Name
  ) => Promise<Sealed[Name]>;
}

type Waiter = PromiseWithResolvers<unknown>;

export const createRenewalBatcher = <Sealed extends object>({
  names,
  fetchBatch,
  windowMs = RENEWAL_WINDOW_MS,
  reuseMs = RENEWAL_REUSE_MS,
}: {
  // Every live query; each request asks for all of them
  names: readonly (keyof Sealed & string)[];
  fetchBatch: (
    names: readonly (keyof Sealed & string)[]
  ) => Promise<Partial<Sealed>>;
  windowMs?: number;
  reuseMs?: number;
}): RenewalBatcher<Sealed> => {
  type Name = keyof Sealed & string;
  // Sealed queries from the last request that nobody has taken yet
  const kept = new Map<Name, { sealed: unknown; at: number }>();
  // Who waits for the next request (or the one under way)
  let waiting = new Map<Name, Waiter[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;

  // Hands each waiter its query; ones nobody waits for are kept
  const handOut = (served: Map<Name, Waiter[]>, result: Partial<Sealed>) => {
    const at = Date.now();
    for (const name of names) {
      const sealed = result[name];
      const waiters = served.get(name);
      if (!waiters) {
        if (sealed !== undefined) {
          kept.set(name, { at, sealed });
        }
        continue;
      }
      for (const waiter of waiters) {
        if (sealed === undefined) {
          waiter.reject(new Error(`No sealed query for ${name}`));
        } else {
          waiter.resolve(sealed);
        }
      }
    }
  };

  const send = async () => {
    timer = undefined;
    inFlight = true;
    try {
      const result = await fetchBatch(names);
      // Renewals asked for while it was under way get it too
      const served = waiting;
      waiting = new Map();
      handOut(served, result);
    } catch (error) {
      const failed = waiting;
      waiting = new Map();
      for (const waiters of failed.values()) {
        for (const waiter of waiters) {
          waiter.reject(error);
        }
      }
    } finally {
      inFlight = false;
    }
  };

  const schedule = () => {
    if (inFlight || timer !== undefined) {
      return;
    }
    timer = setTimeout(() => {
      send().catch(() => null);
    }, windowMs);
  };

  return {
    renew: <Key extends Name>(name: Key) => {
      const spare = kept.get(name);
      kept.delete(name);
      if (spare && Date.now() - spare.at < reuseMs) {
        return Promise.resolve(spare.sealed as Sealed[Key]);
      }
      const waiter = Promise.withResolvers<unknown>();
      const waiters = waiting.get(name) ?? [];
      waiters.push(waiter);
      waiting.set(name, waiters);
      schedule();
      return waiter.promise as Promise<Sealed[Key]>;
    },
  };
};
