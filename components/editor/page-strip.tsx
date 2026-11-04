"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiMoreLine,
} from "@remixicon/react";
import { useMemo } from "react";
import type { ComponentProps } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePageThumbnails } from "@/hooks/use-page-thumbnails";
import type { PageView } from "@/lib/collab/changeset";
import { peerPageId } from "@/lib/collab/presence";
import type { Peer } from "@/lib/collab/presence";
import { MAX_PAGES } from "@/lib/document/schema";
import { cn } from "@/lib/utils";

// The box a page's picture fits in, CSS px
const TILE = { height: 56, width: 112 };
// Avatars of people on a page, at most
const MAX_PEERS = 3;

// A page's picture size: the page's shape fitted into TILE
const tileSize = (page: PageView) => {
  const { height, width } = page.doc.document;
  const scale = Math.min(TILE.width / width, TILE.height / height);
  return {
    height: Math.max(8, Math.round(height * scale)),
    width: Math.max(8, Math.round(width * scale)),
  };
};

// A dot in each person's colour on the page they're on (their names are in
// the page's label)
const PeerDots = ({ peers }: { peers: readonly Peer[] }) =>
  peers.length > 0 ? (
    <span aria-hidden className="absolute -top-1 -right-1 flex -space-x-1">
      {peers.slice(0, MAX_PEERS).map((peer) => (
        <span
          key={peer.clientId}
          className="ring-background size-3 rounded-full bg-(--peer-color) ring-2"
          style={{ "--peer-color": peer.color }}
        />
      ))}
    </span>
  ) : null;

// The page's picture, a button that goes to the page (and the handle that
// drags it)
const PageButton = ({
  size,
  ...props
}: ComponentProps<"button"> & { size: { width: number; height: number } }) => (
  <button
    type="button"
    className="ring-border focus-visible:ring-ring data-[active=true]:ring-primary relative flex h-(--tile-h) w-(--tile-w) cursor-pointer items-center justify-center overflow-hidden rounded-md bg-white ring-1 outline-none focus-visible:ring-2 data-[active=true]:ring-2"
    style={{
      "--tile-h": `${size.height}px`,
      "--tile-w": `${size.width}px`,
    }}
    {...props}
  />
);

const PageTile = ({
  page,
  index,
  count,
  active,
  url,
  peers,
}: {
  page: PageView;
  index: number;
  count: number;
  active: boolean;
  url: string | undefined;
  peers: readonly Peer[];
}) => {
  const store = useEditorStoreApi();
  const { isDragging, listeners, setNodeRef, transform } = useSortable({
    id: page.id,
  });
  const size = tileSize(page);
  const label = `Page ${index + 1}`;
  const here =
    peers.length > 0
      ? `${label}: ${peers.map((peer) => peer.name).join(", ")} ${peers.length === 1 ? "is" : "are"} here`
      : label;

  return (
    <li
      ref={setNodeRef}
      data-dragging={isDragging}
      className="relative flex shrink-0 translate-x-(--dx) translate-y-(--dy) flex-col items-center gap-1 transition-transform duration-200 data-[dragging=true]:z-10 data-[dragging=true]:transition-none"
      style={{
        "--dx": `${transform?.x ?? 0}px`,
        "--dy": `${transform?.y ?? 0}px`,
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PageButton
              size={size}
              aria-label={here}
              aria-current={active ? "page" : undefined}
              data-active={active}
              onClick={() => store.getState().setActivePage(page.id)}
              {...listeners}
            />
          }
        >
          {url ? (
            // oxlint-disable-next-line nextjs/no-img-element -- a blob URL drawn in this tab
            <img
              src={url}
              alt=""
              width={size.width}
              height={size.height}
              draggable={false}
              className="pointer-events-none size-full object-contain"
            />
          ) : (
            <span className="bg-muted size-full animate-pulse" />
          )}
        </TooltipTrigger>
        <TooltipContent>{here}</TooltipContent>
      </Tooltip>
      <PeerDots peers={peers} />
      <div className="flex items-center gap-0.5">
        <span
          aria-hidden
          className={cn(
            "text-muted-foreground px-1 text-xs tabular-nums",
            active && "text-foreground font-medium"
          )}
        >
          {index + 1}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for page ${index + 1}`}
              />
            }
          >
            <RiMoreLine />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={count >= MAX_PAGES}
                onClick={() => store.getState().duplicatePage(page.id)}
              >
                <RiFileCopyLine />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === 0}
                onClick={() => store.getState().movePage(page.id, index - 1)}
              >
                <RiArrowLeftLine />
                Move left
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === count - 1}
                onClick={() => store.getState().movePage(page.id, index + 1)}
              >
                <RiArrowRightLine />
                Move right
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                disabled={count < 2}
                onClick={() => store.getState().deletePage(page.id)}
              >
                <RiDeleteBinLine />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
};

// The pages under the canvas: a picture of each (click to go there, drag
// to reorder, a menu to duplicate, move or delete it), Add page, and which
// page this is. PageUp and PageDown switch pages too. The last page can't
// be deleted.
export const PageStrip = () => {
  const store = useEditorStoreApi();
  const pages = useEditor((state) => state.pages);
  const activePageId = useEditor((state) => state.activePageId);
  const peers = useEditor((state) => state.peers);
  const urls = usePageThumbnails(pages, TILE);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const ids = useMemo(() => pages.map((page) => page.id), [pages]);
  const [firstPageId = activePageId] = ids;
  const peersByPage = useMemo(() => {
    const byPage = new Map<string, Peer[]>();
    for (const peer of peers) {
      const pageId = peerPageId(peer, firstPageId);
      byPage.set(pageId, [...(byPage.get(pageId) ?? []), peer]);
    }
    return byPage;
  }, [peers, firstPageId]);
  const activeIndex = ids.indexOf(activePageId);

  // A drop moves the page to where the page it's over was
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const to = ids.indexOf(String(over.id));
    if (to !== -1) {
      store.getState().movePage(String(active.id), to);
    }
  };

  return (
    <section
      aria-label="Pages"
      className="bg-background flex shrink-0 items-center gap-3 border-t px-3 py-2"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <ol className="flex min-w-0 items-end gap-3 overflow-x-auto px-2 pt-2">
            {pages.map((page, index) => (
              <PageTile
                key={page.id}
                page={page}
                index={index}
                count={pages.length}
                active={page.id === activePageId}
                url={urls.get(page.id)}
                peers={peersByPage.get(page.id) ?? []}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={pages.length >= MAX_PAGES}
        onClick={() => store.getState().addPage()}
      >
        <RiAddLine data-icon="inline-start" />
        Add page
      </Button>
      <output
        aria-label={`Page ${activeIndex + 1} of ${pages.length}`}
        className="text-muted-foreground ml-auto shrink-0 text-sm tabular-nums"
      >
        {activeIndex + 1} / {pages.length}
      </output>
    </section>
  );
};
