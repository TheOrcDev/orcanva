"use client";

import { RiDownload2Line } from "@remixicon/react";
import { useId, useState, useTransition } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
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
import { selectDocument } from "@/lib/editor/store";
import { prepareForRender } from "@/lib/export/prepare";
import {
  EXPORT_EXTENSIONS,
  downloadBlob,
  renderPage,
} from "@/lib/export/render-page";
import type { ExportFormat } from "@/lib/export/render-page";
import { formatSize } from "@/lib/format";

const FORMATS: { value: ExportFormat; label: string }[] = [
  { label: "PNG", value: "png" },
  { label: "JPG", value: "jpeg" },
  { label: "WebP", value: "webp" },
];

const MULTIPLIERS = [1, 2];

const isFormat = (value: unknown): value is ExportFormat =>
  FORMATS.some((format) => format.value === value);

export const ExportPopover = () => {
  const id = useId();
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();
  const width = useEditor((state) => selectDocument(state).width);
  const height = useEditor((state) => selectDocument(state).height);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(92);
  const [multiplier, setMultiplier] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const [isExporting, startExport] = useTransition();

  const page = { height, width };
  const effectiveMultiplier = canExportAt(page, multiplier) ? multiplier : 1;
  const supportsTransparency = format !== "jpeg";

  const download = () => {
    startExport(async () => {
      const node = pageNodeRef.current;
      if (!node) {
        return;
      }
      try {
        // Ending an in-progress text edit commits it; prepare waits a frame
        // so the canvas shows it before the document is read
        store.getState().setEditingText(null);
        await prepareForRender(selectDocument(store.getState()));
        const state = store.getState();
        const document = selectDocument(state);
        await prepareForRender(document);
        const blob = await renderPage(node, document, {
          format,
          pixelRatio: effectiveMultiplier,
          quality: format === "png" ? undefined : quality / 100,
          transparent: supportsTransparency && transparent,
        });
        const size = `${document.width * effectiveMultiplier}x${document.height * effectiveMultiplier}`;
        downloadBlob(
          blob,
          `${slugify(state.name)}-${size}.${EXPORT_EXTENSIONS[format]}`
        );
      } catch {
        toast.add({ title: "Export failed", type: "error" });
      }
    });
  };

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
            Exported at exact pixel size from the canvas.
          </PopoverDescription>
        </PopoverHeader>
        <FieldGroup>
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
            Download {FORMATS.find((item) => item.value === format)?.label}
          </Button>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
};
