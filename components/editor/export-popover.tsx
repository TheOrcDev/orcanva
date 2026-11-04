"use client";

import { RiDownload2Line } from "@remixicon/react";
import { useId, useState, useTransition } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { usePageRenderer } from "@/components/editor/canvas/static-page";
import type { RenderOffscreen } from "@/components/editor/canvas/static-page";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { canExportAt, slugify } from "@/lib/document/geometry";
import type { DesignDocument } from "@/lib/document/schema";
import { selectDocument } from "@/lib/editor/store";
import type { EditorStoreApi } from "@/lib/editor/store";
import { prepareForRender } from "@/lib/export/prepare";
import {
  EXPORT_EXTENSIONS,
  downloadBlob,
  renderPage,
} from "@/lib/export/render-page";
import type { ExportFormat, RenderOptions } from "@/lib/export/render-page";
import { formatSize } from "@/lib/format";

type DownloadFormat = ExportFormat | "pdf";
type PageScope = "this" | "all";

const FORMATS: { value: DownloadFormat; label: string }[] = [
  { label: "PNG", value: "png" },
  { label: "JPG", value: "jpeg" },
  { label: "WebP", value: "webp" },
  { label: "PDF", value: "pdf" },
];

const SCOPES: { value: PageScope; label: string }[] = [
  { label: "This page", value: "this" },
  { label: "All pages", value: "all" },
];

const MULTIPLIERS = [1, 2];
// A PDF's pages are pictures at twice their size (about 190 dpi), unless
// that's more than a download may draw
const PDF_MULTIPLIER = 2;

const isFormat = (value: unknown): value is DownloadFormat =>
  FORMATS.some((format) => format.value === value);

const isScope = (value: unknown): value is PageScope =>
  SCOPES.some((scope) => scope.value === value);

// "-01", "-02", … for one of several pages
const pageSuffix = (index: number) => `-${String(index + 1).padStart(2, "0")}`;

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

// Draws pages one at a time: the one on screen from the canvas, the others
// off screen. `onPage` hears which page is being drawn.
const drawPages = async (
  store: EditorStoreApi,
  node: Parameters<typeof renderPage>[0],
  render: RenderOffscreen,
  pages: readonly { id: string; document: DesignDocument }[],
  options: RenderOptions,
  onPage: (index: number) => void
): Promise<Blob[]> => {
  const blobs: Blob[] = [];
  for (const [index, page] of pages.entries()) {
    onPage(index);
    if (page.id === store.getState().activePageId) {
      // oxlint-disable-next-line no-await-in-loop -- one page at a time
      await prepareForRender(page.document);
      // oxlint-disable-next-line no-await-in-loop -- one page at a time
      blobs.push(await renderPage(node, page.document, options));
    } else {
      // oxlint-disable-next-line no-await-in-loop -- one page at a time
      blobs.push(await render(page.document, options));
    }
  }
  return blobs;
};

// The ZIP and PDF writers load only when a download needs them
const loadZip = () => import("@/lib/export/zip");
const loadPdf = () => import("@/lib/export/pdf");

// Draws the page on screen, or every page, and downloads them: one picture
// as it is, several in a ZIP, or all in a PDF. `onPage` hears which page of
// several is being drawn.
const downloadPages = async ({
  allPages,
  format,
  node,
  onPage,
  quality,
  render,
  size,
  store,
  transparent,
}: {
  allPages: boolean;
  format: DownloadFormat;
  node: Parameters<typeof renderPage>[0];
  onPage: (progress: { done: number; total: number } | null) => void;
  quality: number;
  render: RenderOffscreen;
  size: number;
  store: EditorStoreApi;
  transparent: boolean;
}): Promise<void> => {
  // Ending an in-progress text edit commits it; prepare waits a frame so
  // the canvas shows it before the document is read
  store.getState().setEditingText(null);
  await prepareForRender(selectDocument(store.getState()));
  const state = store.getState();
  const pages = (
    allPages
      ? state.pages
      : state.pages.filter((item) => item.id === state.activePageId)
  ).map((item) => ({ document: item.doc.document, id: item.id }));
  const { height, width } = selectDocument(state);
  const name = slugify(state.name);
  const progress = (index: number) =>
    onPage(pages.length > 1 ? { done: index, total: pages.length } : null);

  if (format === "pdf") {
    const ratio = canExportAt({ height, width }, PDF_MULTIPLIER)
      ? PDF_MULTIPLIER
      : 1;
    const blobs = await drawPages(
      store,
      node,
      render,
      pages,
      { format: "jpeg", pixelRatio: ratio, quality: quality / 100 },
      progress
    );
    const { PT_PER_PX, pdfBlob } = await loadPdf();
    const pdfPages = await Promise.all(
      blobs.map(async (blob) => ({
        height: height * PT_PER_PX,
        jpeg: await bytesOf(blob),
        width: width * PT_PER_PX,
      }))
    );
    downloadBlob(
      pdfBlob(pdfPages, { title: state.name }),
      `${name}-${width}x${height}.pdf`
    );
    return;
  }

  const blobs = await drawPages(
    store,
    node,
    render,
    pages,
    {
      format,
      pixelRatio: size,
      quality: format === "png" ? undefined : quality / 100,
      transparent,
    },
    progress
  );
  const pixels = `${width * size}x${height * size}`;
  const extension = EXPORT_EXTENSIONS[format];
  const [only] = blobs;
  if (blobs.length === 1 && only) {
    downloadBlob(only, `${name}-${pixels}.${extension}`);
    return;
  }
  const { zipBlob } = await loadZip();
  const files = await Promise.all(
    blobs.map(async (blob, index) => ({
      data: await bytesOf(blob),
      name: `${name}-${pixels}${pageSuffix(index)}.${extension}`,
    }))
  );
  downloadBlob(zipBlob(files), `${name}-${pixels}.zip`);
};

export const ExportPopover = () => {
  const id = useId();
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();
  const render = usePageRenderer();
  const width = useEditor((state) => selectDocument(state).width);
  const height = useEditor((state) => selectDocument(state).height);
  const pageCount = useEditor((state) => state.pages.length);
  const [format, setFormat] = useState<DownloadFormat>("png");
  const [scope, setScope] = useState<PageScope>("this");
  const [quality, setQuality] = useState(92);
  const [multiplier, setMultiplier] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const [isExporting, startExport] = useTransition();
  // Which page is being drawn, while several are
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const page = { height, width };
  const isPdf = format === "pdf";
  const effectiveMultiplier = canExportAt(page, multiplier) ? multiplier : 1;
  const supportsTransparency = format === "png" || format === "webp";
  const allPages = pageCount > 1 && scope === "all";

  const download = () => {
    startExport(async () => {
      const node = pageNodeRef.current;
      if (!node) {
        return;
      }
      try {
        await downloadPages({
          allPages,
          format,
          node,
          onPage: setProgress,
          quality,
          render,
          size: effectiveMultiplier,
          store,
          transparent: supportsTransparency && transparent,
        });
      } catch {
        toast.add({ title: "Export failed", type: "error" });
      }
      setProgress(null);
    });
  };

  const label = FORMATS.find((item) => item.value === format)?.label;
  let action = `Download ${label}`;
  if (allPages && !isPdf) {
    action = `Download ${pageCount} ${label}s (ZIP)`;
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button />}>
        <RiDownload2Line data-icon="inline-start" />
        Download
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Download</PopoverTitle>
          <PopoverDescription>
            {isPdf
              ? "Each page as a sharp picture, at twice its pixel size."
              : "Exported at exact pixel size from the canvas."}
          </PopoverDescription>
        </PopoverHeader>
        <FieldGroup>
          {pageCount > 1 ? (
            <Field>
              <FieldLabel>Pages</FieldLabel>
              <ToggleGroup
                variant="outline"
                value={[scope]}
                onValueChange={(value) => {
                  const [next] = value;
                  if (isScope(next)) {
                    setScope(next);
                  }
                }}
              >
                {SCOPES.map((item) => (
                  <ToggleGroupItem key={item.value} value={item.value}>
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {scope === "all" && !isPdf ? (
                <FieldDescription>
                  One file per page, together in a ZIP.
                </FieldDescription>
              ) : null}
            </Field>
          ) : null}
          <Field>
            <FieldLabel>File type</FieldLabel>
            <ToggleGroup
              variant="outline"
              value={[format]}
              onValueChange={(value) => {
                const [next] = value;
                if (isFormat(next)) {
                  setFormat(next);
                }
              }}
            >
              {FORMATS.map((item) => (
                <ToggleGroupItem key={item.value} value={item.value}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          {isPdf ? null : (
            <Field>
              <FieldLabel>Size</FieldLabel>
              <ToggleGroup
                variant="outline"
                value={[String(effectiveMultiplier)]}
                onValueChange={(value) => {
                  const next = Number(value[0]);
                  if (MULTIPLIERS.includes(next)) {
                    setMultiplier(next);
                  }
                }}
              >
                {MULTIPLIERS.map((item) => (
                  <ToggleGroupItem
                    key={item}
                    value={String(item)}
                    disabled={!canExportAt(page, item)}
                  >
                    {item}× · {formatSize(width * item, height * item)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          )}
          {format === "png" ? null : (
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Quality</FieldLabel>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {quality}%
                </span>
              </div>
              <Slider
                aria-label="Quality"
                value={[quality]}
                min={40}
                max={100}
                onValueChange={(value) =>
                  setQuality(
                    typeof value === "number" ? value : (value[0] ?? 92)
                  )
                }
              />
            </Field>
          )}
          {supportsTransparency ? (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={`${id}-transparent`}>
                  Transparent background
                </FieldLabel>
                <FieldDescription>Leave out the page fill.</FieldDescription>
              </FieldContent>
              <Switch
                id={`${id}-transparent`}
                checked={transparent}
                onCheckedChange={setTransparent}
              />
            </Field>
          ) : null}
          <Button disabled={isExporting} onClick={download}>
            {isExporting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RiDownload2Line data-icon="inline-start" />
            )}
            {progress
              ? `Drawing page ${progress.done + 1} of ${progress.total}…`
              : action}
          </Button>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
};
