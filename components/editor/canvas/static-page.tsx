"use client";

import type Konva from "konva";
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, Ref } from "react";
import { Group, Layer, Rect, Stage } from "react-konva";

import { BackgroundNode } from "@/components/editor/canvas/background-node";
import { ElementNode } from "@/components/editor/canvas/element-node";
import type { ElementNodeProps } from "@/components/editor/canvas/element-node";
import {
  EditorStoreProvider,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { fitZoom } from "@/lib/document/geometry";
import type { DesignDocument } from "@/lib/document/schema";
import { createEditorStore } from "@/lib/editor/store";
import type { EditorAsset, EditorStoreApi } from "@/lib/editor/store";
import { prepareForRender } from "@/lib/export/prepare";
import { renderPage } from "@/lib/export/render-page";
import type { RenderOptions } from "@/lib/export/render-page";
import { createRenderQueue } from "@/lib/export/render-queue";

// The static page renderer: a document drawn read-only through the
// editor's own nodes (BackgroundNode, ElementNode), so photos, filters,
// photo effects, text effects and graphics look exactly as they do in the
// editor and in downloads. Nothing listens and every handler does nothing.
//
// The nodes read their images and missing-image marks from an editor store,
// so a static page is drawn inside its own store's provider (createStaticStore),
// never the editor's: the editor's selection, crop and zoom stay out of it.
//
// Modes:
// - on screen: StaticPageView fits one page into its box (the version
//   preview);
// - off screen: PageRenderHost (mounted once in the editor) draws any
//   document that isn't on screen, one page at a time from a queue, in a
//   hidden Stage, and usePageRenderer() hands back its blob from
//   renderStaticPage. Magic Resize's previews and its copies' thumbnails
//   use it; multi-page export can too.

// Returns nothing anyone reads
const ignore = () => null;
const stay: ElementNodeProps["onDragBound"] = (_id, position) => position;

// Every handler ElementNode wants, doing nothing
const STATIC_HANDLERS = {
  onClick: ignore,
  onCrop: ignore,
  onDragBound: stay,
  onDragEnd: ignore,
  onDragMove: ignore,
  onDragStart: ignore,
  onEditText: ignore,
  onPress: ignore,
} satisfies Omit<ElementNodeProps, "element" | "preview">;

export interface StaticPageProps {
  document: DesignDocument;
  // The page group, in design units once cloned: what renderPage and
  // renderThumbnail take, like the workspace's page node
  pageRef?: Ref<Konva.Group>;
  x?: number;
  y?: number;
  // Screen pixels per design pixel
  scale?: number;
}

// The page's background and elements, clipped to the page
export const StaticPage = ({
  document,
  pageRef,
  scale = 1,
  x = 0,
  y = 0,
}: StaticPageProps) => (
  <Group
    ref={pageRef}
    listening={false}
    x={x}
    y={y}
    scaleX={scale}
    scaleY={scale}
    clipX={0}
    clipY={0}
    clipWidth={document.width}
    clipHeight={document.height}
  >
    <BackgroundNode
      background={document.background}
      width={document.width}
      height={document.height}
    />
    {document.elements.map((element) => (
      <ElementNode
        key={element.id}
        element={element}
        preview={null}
        {...STATIC_HANDLERS}
      />
    ))}
  </Group>
);

// A store that only draws: no live queries, nothing to save or undo.
// `assets` are the images the document may show; `missingAssetIds` the ones
// the server doesn't have, drawn as missing rather than loading forever.
export const createStaticStore = ({
  assets,
  designId,
  document,
  missingAssetIds = [],
  positions,
}: {
  assets: EditorAsset[];
  designId: string;
  document: DesignDocument;
  missingAssetIds?: readonly string[];
  positions?: Record<string, string>;
}): EditorStoreApi => {
  const store = createEditorStore({
    assets,
    designId,
    document,
    hasThumbnail: true,
    libraryIds: [],
    live: null,
    name: "",
    positions,
    role: "editor",
    viewer: null,
    visibility: "private",
  });
  store.getState().markAssetsMissing(missingAssetIds);
  return store;
};

// Draws the page through renderPage once everything on it has loaded:
// fonts, images (with their filters) and photo effects (the render
// preparers). `node` is a StaticPage's (or the workspace's) page group.
export const renderStaticPage = async (
  node: Konva.Group,
  document: DesignDocument,
  options: RenderOptions
): Promise<Blob> => {
  await prepareForRender(document);
  return renderPage(node, document, options);
};

// Room around the page on screen, in CSS pixels
const VIEW_PADDING = 32;

// On-screen mode: the page fitted into this element's box (which needs a
// size of its own), drawn with `store`'s images. `onPage` (a stable
// callback, such as a state setter) gets the page group once it and every
// element on it have mounted, so a caller can wait for the render preparers
// from then on.
export const StaticPageView = ({
  className,
  document,
  onPage,
  store,
}: {
  className?: string;
  document: DesignDocument;
  onPage?: (node: Konva.Group | null) => void;
  store: EditorStoreApi;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setViewport({
          height: entry.contentRect.height,
          width: entry.contentRect.width,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const zoom = fitZoom(document, viewport, VIEW_PADDING);
  const origin = {
    x: (viewport.width - document.width * zoom) / 2,
    y: (viewport.height - document.height * zoom) / 2,
  };

  return (
    <div ref={containerRef} className={className}>
      {viewport.width > 0 && viewport.height > 0 ? (
        <EditorStoreProvider store={store}>
          <Stage width={viewport.width} height={viewport.height}>
            <Layer listening={false}>
              <Rect
                x={origin.x}
                y={origin.y}
                width={document.width * zoom}
                height={document.height * zoom}
                fill="#ffffff"
                shadowColor="#000000"
                shadowBlur={24}
                shadowOpacity={0.12}
                shadowOffsetY={4}
              />
              <StaticPage
                document={document}
                pageRef={onPage}
                scale={zoom}
                x={origin.x}
                y={origin.y}
              />
            </Layer>
          </Stage>
        </EditorStoreProvider>
      ) : null}
    </div>
  );
};

// Off-screen mode: draws a document that isn't on screen and returns it as
// an image. `signal` drops a job that hasn't started yet.
export type RenderOffscreen = (
  document: DesignDocument,
  options: RenderOptions,
  signal?: AbortSignal
) => Promise<Blob>;

const PageRenderContext = createContext<RenderOffscreen | null>(null);

// Longest a page may take to mount before its job fails
const MOUNT_TIMEOUT_MS = 10_000;

interface OffscreenPage {
  key: number;
  document: DesignDocument;
  store: EditorStoreApi;
  onPage: (node: Konva.Group | null) => void;
}

// The page group, once the page and everything on it has mounted
const waitForPage = (
  onMounted: (onPage: (node: Konva.Group | null) => void) => void
): Promise<Konva.Group> => {
  const { promise, reject, resolve } = Promise.withResolvers<Konva.Group>();
  const timer = setTimeout(
    () => reject(new Error("The page didn't draw")),
    MOUNT_TIMEOUT_MS
  );
  onMounted((node) => {
    if (node) {
      clearTimeout(timer);
      resolve(node);
    }
  });
  return promise;
};

type ShowPage = (
  update: (current: OffscreenPage | null) => OffscreenPage | null
) => void;

// The queue behind PageRenderHost: each job mounts its page (through
// `show`), waits for it, draws it once the render preparers are done, and
// unmounts it. It draws with the editor's images: their URLs come from the
// editor's store, which is also where the image preloader looks.
const createOffscreenRenderer = (
  editor: EditorStoreApi,
  show: ShowPage
): RenderOffscreen => {
  let count = 0;
  const queue = createRenderQueue(
    async ({
      document,
      options,
    }: {
      document: DesignDocument;
      options: RenderOptions;
    }) => {
      const { assets, designId, missingAssetIds } = editor.getState();
      const store = createStaticStore({
        assets,
        designId,
        document,
        missingAssetIds,
      });
      count += 1;
      const key = count;
      const hide = () =>
        show((current) => (current?.key === key ? null : current));
      try {
        const node = await waitForPage((onPage) =>
          show(() => ({ document, key, onPage, store }))
        );
        const blob = await renderStaticPage(node, document, options);
        hide();
        return blob;
      } catch (error) {
        hide();
        throw error;
      }
    }
  );
  return (document, options, signal) =>
    queue.render({ document, options }, signal);
};

// Mounts the page being drawn off screen (laid out, so Konva builds it,
// but out of sight and out of reach), and offers usePageRenderer() to what
// it wraps
export const PageRenderHost = ({ children }: { children: ReactNode }) => {
  const editor = useEditorStoreApi();
  const [page, setPage] = useState<OffscreenPage | null>(null);
  const render = useMemo(
    () => createOffscreenRenderer(editor, setPage),
    [editor]
  );

  return (
    <PageRenderContext value={render}>
      {children}
      {page ? (
        <div
          aria-hidden
          inert
          className="pointer-events-none fixed top-0 -left-[10000px] size-px overflow-hidden"
        >
          <EditorStoreProvider store={page.store}>
            <Stage width={1} height={1}>
              <Layer listening={false}>
                <StaticPage
                  key={page.key}
                  document={page.document}
                  pageRef={page.onPage}
                />
              </Layer>
            </Stage>
          </EditorStoreProvider>
        </div>
      ) : null}
    </PageRenderContext>
  );
};

export const usePageRenderer = (): RenderOffscreen => {
  const render = use(PageRenderContext);
  if (!render) {
    throw new Error("usePageRenderer must be used inside PageRenderHost");
  }
  return render;
};
