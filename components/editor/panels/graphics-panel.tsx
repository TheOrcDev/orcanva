"use client";

import { RiEmotionLine, RiSearchLine } from "@remixicon/react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { GraphicTile } from "@/components/editor/panels/graphic-tile";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { loadCatalog, loadEntries, noticesUrl } from "@/lib/graphics/catalog";
import type { Catalog } from "@/lib/graphics/catalog";
import type { IndexRow } from "@/lib/graphics/catalog-data";
import { FOR_THUMBNAILS } from "@/lib/graphics/curated";
import type { GraphicEntry } from "@/lib/graphics/entry";
import { searchGraphics } from "@/lib/graphics/search";
import type { GraphicFilter } from "@/lib/graphics/search";

// Tiles per screenful; "Show more" adds as many again
const PAGE_SIZE = 48;

const FILTERS: { value: GraphicFilter; label: string }[] = [
  { label: "All", value: "all" },
  { label: "Icons", value: "icon" },
  { label: "Emoji", value: "emoji" },
  { label: "Stickers", value: "sticker" },
];

const isFilter = (value: unknown): value is GraphicFilter =>
  FILTERS.some((filter) => filter.value === value);

type CatalogState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; catalog: Catalog };

// Fetches the catalog the first time the tab opens (later opens reuse it)
const useCatalog = (): CatalogState => {
  const [state, setState] = useState<CatalogState>({ status: "loading" });

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const catalog = await loadCatalog();
        if (live) {
          setState({ catalog, status: "ready" });
        }
      } catch {
        if (live) {
          setState({ status: "error" });
        }
      }
    };
    load().catch(() => null);
    return () => {
      live = false;
    };
  }, []);

  return state;
};

// What's known about each row's art: the entry, or null when its shard
// doesn't have it (so it isn't asked for again)
type Entries = ReadonlyMap<string, GraphicEntry | null>;

// The art for the rows on screen, fetched shard by shard as they appear
const useEntries = (rows: readonly IndexRow[]) => {
  const [entries, setEntries] = useState<Entries>(() => new Map());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const missing = rows.filter(([id]) => !entries.has(id));
    if (missing.length === 0) {
      return;
    }
    let live = true;
    const load = async () => {
      try {
        const loaded = await loadEntries(missing);
        const found = new Map(loaded.map((entry) => [entry.id, entry]));
        if (live) {
          setEntries((current) => {
            const next = new Map(current);
            for (const [id] of missing) {
              next.set(id, found.get(id) ?? null);
            }
            return next;
          });
        }
      } catch {
        if (live) {
          setFailed(true);
        }
      }
    };
    load().catch(() => null);
    return () => {
      live = false;
    };
  }, [rows, entries]);

  return { entries, failed };
};

const resultsLabel = (count: number) =>
  count === 1 ? "1 graphic" : `${count.toLocaleString("en")} graphics`;

const LoadingTiles = ({ count }: { count: number }) => (
  <div className="grid grid-cols-4 gap-2" aria-hidden>
    {Array.from({ length: count }, (_, index) => (
      // oxlint-disable-next-line react/no-array-index-key
      <Skeleton key={index} className="aspect-square w-full" />
    ))}
  </div>
);

const Results = ({
  label,
  rows,
  entries,
}: {
  label: string;
  rows: readonly IndexRow[];
  entries: Entries;
}) => (
  <ul className="grid grid-cols-4 gap-2" aria-label={label}>
    {rows.flatMap(([id, , name]) => {
      const entry = entries.get(id);
      // Art the catalog lost: nothing to show
      if (entry === null) {
        return [];
      }
      return (
        <li key={id}>
          {entry ? (
            <GraphicTile graphic={entry} />
          ) : (
            <Skeleton
              className="aspect-square w-full"
              aria-label={`Loading ${name}`}
            />
          )}
        </li>
      );
    })}
  </ul>
);

const LoadFailed = ({ onRetry }: { onRetry: () => void }) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiEmotionLine />
      </EmptyMedia>
      <EmptyTitle>Couldn’t load graphics</EmptyTitle>
      <EmptyDescription>Check your connection and try again.</EmptyDescription>
    </EmptyHeader>
    <Button variant="outline" size="sm" onClick={onRetry}>
      Try again
    </Button>
  </Empty>
);

const NothingFound = () => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RiSearchLine />
      </EmptyMedia>
      <EmptyTitle>Nothing found</EmptyTitle>
      <EmptyDescription>Try another word, or All.</EmptyDescription>
    </EmptyHeader>
  </Empty>
);

const Credits = () => (
  <p className="text-muted-foreground text-xs">
    Icons: Tabler (MIT) · Emoji: Microsoft Fluent (MIT) ·{" "}
    <a
      href={noticesUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-foreground underline underline-offset-2"
    >
      Licences
    </a>
  </p>
);

// The graphics for a search, or the set for thumbnails. Remounted to retry
// after a failed fetch.
const CatalogView = ({
  query,
  filter,
  limit,
  onShowMore,
  onRetry,
}: {
  query: string;
  filter: GraphicFilter;
  limit: number;
  onShowMore: () => void;
  onRetry: () => void;
}) => {
  const state = useCatalog();
  const curated = filter === "all" && query.trim() === "";

  const rows = useMemo((): IndexRow[] => {
    if (state.status !== "ready") {
      return [];
    }
    const { catalog } = state;
    if (curated) {
      return FOR_THUMBNAILS.flatMap((id) => {
        const row = catalog.byId.get(id);
        return row ? [row] : [];
      });
    }
    return searchGraphics(catalog.search, query, filter);
  }, [state, curated, query, filter]);

  const visible = useMemo(() => rows.slice(0, limit), [rows, limit]);
  const { entries, failed } = useEntries(visible);

  let content = <LoadingTiles count={16} />;
  if (state.status === "error" || failed) {
    content = <LoadFailed onRetry={onRetry} />;
  } else if (state.status === "ready" && rows.length === 0) {
    content = <NothingFound />;
  } else if (state.status === "ready") {
    content = (
      <>
        <Results
          label={curated ? "For thumbnails" : "Search results"}
          rows={visible}
          entries={entries}
        />
        {rows.length > limit ? (
          <Button variant="outline" size="sm" onClick={onShowMore}>
            Show more
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <PanelSection title={curated ? "For thumbnails" : "Results"}>
      <output className="sr-only" aria-live="polite">
        {state.status === "ready" ? resultsLabel(rows.length) : ""}
      </output>
      {content}
    </PanelSection>
  );
};

// Icons, emoji and stickers to search and add, by click or by dragging
// them onto the canvas. Before any search it shows a set picked for
// thumbnails.
export const GraphicsPanel = () => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GraphicFilter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [attempt, setAttempt] = useState(0);
  const deferredQuery = useDeferredValue(query);

  return (
    <>
      <div className="bg-background sticky top-0 z-10 -mx-4 -mt-4 flex flex-col gap-3 px-4 pt-4 pb-1">
        <InputGroup>
          <InputGroupAddon>
            <RiSearchLine />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Search graphics"
            placeholder="Search icons, emoji, stickers"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          />
        </InputGroup>
        <ToggleGroup
          variant="outline"
          size="sm"
          aria-label="Kind of graphic"
          value={[filter]}
          onValueChange={(value) => {
            const [next] = value;
            // Pressing the current chip again keeps it
            if (isFilter(next)) {
              setFilter(next);
              setLimit(PAGE_SIZE);
            }
          }}
        >
          {FILTERS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <CatalogView
        key={attempt}
        query={deferredQuery}
        filter={filter}
        limit={limit}
        onShowMore={() => setLimit((current) => current + PAGE_SIZE)}
        onRetry={() => setAttempt((current) => current + 1)}
      />
      <Credits />
    </>
  );
};
