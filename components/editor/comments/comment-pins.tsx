"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { CommentAvatar } from "@/components/editor/comments/comment-body";
import {
  NewThreadView,
  ThreadView,
} from "@/components/editor/comments/thread-popover";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { anchorLocal, pinAnchor, pinPoint } from "@/lib/comments/anchor";
import type { PinSource, PinState, PlacedPin } from "@/lib/comments/anchor";
import { bodyText } from "@/lib/comments/body";
import type { CommentPin } from "@/lib/comments/schema";
import { groupThreads, isOnPage, isResolved } from "@/lib/comments/threads";
import type { CommentThread } from "@/lib/comments/threads";
import type { DesignElement } from "@/lib/document/schema";
import { selectDocument } from "@/lib/editor/store";
import { cn } from "@/lib/utils";

// A pin is a speech bubble whose bottom-left corner is the spot it marks
const PIN_SIZE = 28;

const EXCERPT_LENGTH = 80;

interface ScreenPoint {
  x: number;
  y: number;
}

interface Follower {
  id: string;
  pin: PinSource;
  element: DesignElement;
}

const NO_PLACES: ReadonlyMap<string, PlacedPin> = new Map();

// Pins on an element someone is dragging or resizing, here or in another
// window, follow its Konva node, which moves before the document does:
// their places are read from it every animation frame while that lasts
const useLivePlaces = (
  followers: readonly Follower[]
): ReadonlyMap<string, PlacedPin> => {
  const pageNodeRef = usePageNodeRef();
  const [places, setPlaces] = useState(NO_PLACES);
  const measure = useEffectEvent(() => {
    const page = pageNodeRef.current;
    const next = new Map<string, PlacedPin>();
    for (const { element, id, pin } of followers) {
      const anchor = pinAnchor(pin);
      const node = page?.findOne(`#${element.id}`);
      if (anchor && node) {
        const point = node.getTransform().point(anchorLocal(anchor, element));
        next.set(id, { ...point, state: "element" });
      }
    }
    setPlaces(next);
  });
  const active = followers.length > 0;
  useEffect(() => {
    if (!active) {
      return;
    }
    let request = requestAnimationFrame(function tick() {
      measure();
      request = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(request);
      // The next gesture starts from the document, not from where this
      // one left its pins
      setPlaces(NO_PLACES);
    };
  }, [active]);
  return places;
};

const pinSource = (pin: CommentPin): PinSource => ({
  anchorHeight: pin.anchor?.anchorHeight ?? null,
  anchorWidth: pin.anchor?.anchorWidth ?? null,
  anchorX: pin.anchor?.anchorX ?? null,
  anchorY: pin.anchor?.anchorY ?? null,
  elementId: pin.anchor?.elementId ?? null,
  x: pin.x,
  y: pin.y,
});

const pinLabel = (thread: CommentThread, state: PinState): string => {
  const text = bodyText(thread.root.body, thread.root.mentions);
  const excerpt =
    text.length > EXCERPT_LENGTH
      ? `${text.slice(0, EXCERPT_LENGTH - 1)}…`
      : text;
  const replies = thread.replies.length;
  return [
    `Comment by ${thread.root.authorName}: ${excerpt}`,
    replies > 0 ? `${replies} ${replies === 1 ? "reply" : "replies"}` : null,
    isResolved(thread) ? "Resolved" : null,
    state === "detached" ? "Its element is gone" : null,
  ]
    .filter(Boolean)
    .join(". ");
};

// The bubble itself; the popover trigger renders through it
const PinButton = ({
  at,
  state,
  resolved = false,
  className,
  style,
  ...props
}: ComponentProps<"button"> & {
  at: ScreenPoint;
  state: PinState;
  resolved?: boolean;
}) => (
  <button
    type="button"
    {...props}
    className={cn(
      "bg-background ring-primary focus-visible:ring-ring pointer-events-auto absolute top-0 left-0 flex size-7 translate-x-(--pin-x) translate-y-(--pin-y) items-center justify-center rounded-full rounded-bl-none p-0.5 shadow-md ring-2 outline-none focus-visible:ring-3 data-popup-open:z-1 data-popup-open:ring-3",
      // Its element is gone: a dashed outline
      state === "detached" &&
        "ring-muted-foreground outline-muted-foreground outline-2 outline-offset-2 outline-dashed",
      resolved && "ring-muted-foreground opacity-70",
      className
    )}
    style={{
      ...style,
      "--pin-x": `${at.x}px`,
      "--pin-y": `${at.y - PIN_SIZE}px`,
    }}
  />
);

const ThreadPin = ({
  thread,
  at,
  state,
  open,
}: {
  thread: CommentThread;
  at: ScreenPoint;
  state: PinState;
  open: boolean;
}) => {
  const store = useEditorStoreApi();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { id } = thread.root;
  const replies = thread.replies.length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        const editor = store.getState();
        if (next) {
          editor.openThread(id);
        } else if (editor.openThreadId === id) {
          editor.openThread(null);
        }
      }}
    >
      <PopoverTrigger
        render={
          <PinButton
            at={at}
            state={state}
            resolved={isResolved(thread)}
            aria-label={pinLabel(thread, state)}
          />
        }
      >
        <CommentAvatar comment={thread.root} className="size-full" />
        {replies > 0 ? (
          <span
            aria-hidden
            className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs leading-none font-semibold tabular-nums"
          >
            {replies}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-80"
        initialFocus={() => textareaRef.current ?? true}
      >
        <ThreadView thread={thread} state={state} textareaRef={textareaRef} />
      </PopoverContent>
    </Popover>
  );
};

const DraftPin = ({ pin, at }: { pin: CommentPin; at: ScreenPoint }) => {
  const store = useEditorStoreApi();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Popover
      open
      onOpenChange={(next) => {
        if (!next && store.getState().draftPin === pin) {
          store.getState().placeDraft(null);
        }
      }}
    >
      <PopoverTrigger
        render={<PinButton at={at} state="page" aria-label="New comment" />}
      >
        <span className="bg-primary size-full rounded-full rounded-bl-none" />
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-80"
        initialFocus={() => textareaRef.current ?? true}
      >
        <NewThreadView pin={pin} textareaRef={textareaRef} />
      </PopoverContent>
    </Popover>
  );
};

// Comment pins over the canvas: an HTML layer at the page's place on
// screen, the same size at any zoom, above the canvas and below others'
// cursors. Open threads show, plus the one that's open; pins on elements
// follow them. Hidden while the page is cropped.
export const CommentPins = ({
  origin,
  zoom,
}: {
  origin: ScreenPoint;
  zoom: number;
}) => {
  const designId = useEditor((state) => state.designId);
  const comments = useEditor((state) => state.comments);
  const openThreadId = useEditor((state) => state.openThreadId);
  const draftPin = useEditor((state) => state.draftPin);
  const pageCrop = useEditor((state) => state.pageCrop);
  const document = useEditor(selectDocument);
  const held = useEditor((state) => state.held);
  const peers = useEditor((state) => state.peers);

  const threads = useMemo(() => groupThreads(comments), [comments]);
  const elements = useMemo(
    () => new Map(document.elements.map((element) => [element.id, element])),
    [document.elements]
  );
  // Elements moving under a gesture, here or in someone else's window
  const moving = useMemo(
    () =>
      new Set([
        ...held,
        ...peers.flatMap(
          (peer) => peer.drag?.moves.map((move) => move.elementId) ?? []
        ),
      ]),
    [held, peers]
  );

  // Until designs have pages, every thread is on the first page, whose id
  // is the design's own
  const shown = threads.filter(
    (thread) =>
      isOnPage(thread.root, designId, designId) &&
      (!isResolved(thread) || thread.root.id === openThreadId)
  );
  const elementOf = (pin: PinSource) =>
    pin.elementId === null ? undefined : elements.get(pin.elementId);
  const followers: Follower[] = [];
  for (const { root } of shown) {
    const element = elementOf(root);
    if (element && moving.has(element.id)) {
      followers.push({ element, id: root.id, pin: root });
    }
  }
  const live = useLivePlaces(followers);

  if (pageCrop) {
    return null;
  }

  const toScreen = (point: { x: number; y: number }): ScreenPoint => ({
    x: origin.x + point.x * zoom,
    y: origin.y + point.y * zoom,
  });
  const draft = draftPin ? pinSource(draftPin) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-5 overflow-hidden">
      {shown.map((thread) => {
        const placed =
          live.get(thread.root.id) ??
          pinPoint(thread.root, elementOf(thread.root));
        return (
          <ThreadPin
            key={thread.root.id}
            thread={thread}
            at={toScreen(placed)}
            state={placed.state}
            open={thread.root.id === openThreadId}
          />
        );
      })}
      {draftPin && draft ? (
        <DraftPin
          pin={draftPin}
          at={toScreen(pinPoint(draft, elementOf(draft)))}
        />
      ) : null}
    </div>
  );
};
