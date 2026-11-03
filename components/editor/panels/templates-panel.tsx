"use client";

import { RiAddBoxLine, RiLayoutLine } from "@remixicon/react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { ComponentProps } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { PanelSection } from "@/components/editor/panels/panel-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { loadTemplate } from "@/lib/actions/templates";
import { findPresetById } from "@/lib/document/presets";
import { stopIfOutdated } from "@/lib/editor/outdated";
import { selectDocument } from "@/lib/editor/store";
import { formatSize } from "@/lib/format";
import { addToPage, replacePage, sameShape } from "@/lib/templates/apply";
import { TEMPLATES } from "@/lib/templates/catalog";
import type { TemplateSummary } from "@/lib/templates/schema";

type Mode = "replace" | "add";

// The tile's face: the preview at the template's own shape
const PreviewButton = (props: ComponentProps<"button">) => (
  <button
    type="button"
    className="bg-muted hover:ring-ring focus-visible:ring-ring data-popup-open:ring-ring relative block aspect-(--tile-aspect) w-full overflow-hidden rounded-xl transition-shadow outline-none hover:ring-2 focus-visible:ring-2 disabled:cursor-wait data-popup-open:ring-2"
    {...props}
  />
);

// A template's preview; opens a menu to replace the page or add to it
const TemplateTile = ({
  template,
  detail,
  pending,
  onPick,
}: {
  template: TemplateSummary;
  detail?: string;
  pending: boolean;
  onPick: (mode: Mode) => void;
}) => (
  <li className="flex flex-col gap-1.5">
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <PreviewButton
            style={{
              "--tile-aspect": `${template.width} / ${template.height}`,
            }}
            aria-label={`Use the ${template.name} template`}
            disabled={pending}
          />
        }
      >
        <Image
          src={template.preview}
          alt=""
          fill
          unoptimized
          sizes="128px"
          className="pointer-events-none object-cover"
        />
        {pending ? (
          <span className="bg-background/60 absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onPick("replace")}>
            <RiLayoutLine />
            Replace page
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPick("add")}>
            <RiAddBoxLine />
            Add to page
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    <div className="flex flex-col text-xs leading-tight">
      <span className="truncate font-medium">{template.name}</span>
      {detail ? (
        <span className="text-muted-foreground truncate">{detail}</span>
      ) : null}
    </div>
  </li>
);

const sizeLabel = (template: TemplateSummary) => {
  const preset = findPresetById(template.presetId);
  return preset
    ? `${preset.label} · ${formatSize(template.width, template.height)}`
    : formatSize(template.width, template.height);
};

export const TemplatesPanel = () => {
  const store = useEditorStoreApi();
  const width = useEditor((state) => selectDocument(state).width);
  const height = useEditor((state) => selectDocument(state).height);
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Replace page waits here for a yes while the page has elements on it
  const [confirming, setConfirming] = useState<TemplateSummary | null>(null);

  const [matching, others] = useMemo(() => {
    const page = { height, width };
    return [
      TEMPLATES.filter((template) => sameShape(template, page)),
      TEMPLATES.filter((template) => !sameShape(template, page)),
    ];
  }, [width, height]);

  const apply = async (template: TemplateSummary, mode: Mode) => {
    setPendingId(template.id);
    try {
      const loaded = await loadTemplate({
        designId: store.getState().designId,
        templateId: template.id,
      });
      const state = store.getState();
      state.finishCrop(true);
      state.finishPageCrop(false);
      state.setEditingText(null);
      // Drawable, but not in the viewer's library: it's not their upload
      state.addAssets(loaded.assets);
      if (mode === "replace") {
        const before = selectDocument(state);
        state.change((document) => replacePage(document, loaded.document));
        const after = selectDocument(store.getState());
        if (after.width !== before.width || after.height !== before.height) {
          state.zoomToFit();
        }
        state.clearSelection();
      } else {
        let added: string[] = [];
        state.change((document) => {
          const result = addToPage(document, loaded.document);
          added = result.ids;
          return result.document;
        });
        state.select(added);
      }
    } catch (error) {
      if (!stopIfOutdated(store, error)) {
        toast.add({
          description: "Check your connection and try again.",
          title: "Could not load the template",
          type: "error",
        });
      }
    }
    setPendingId(null);
  };

  const pick = (template: TemplateSummary, mode: Mode) => {
    const isEmpty = selectDocument(store.getState()).elements.length === 0;
    if (mode === "replace" && !isEmpty) {
      setConfirming(template);
    } else {
      apply(template, mode).catch(() => null);
    }
  };

  const tiles = (list: TemplateSummary[], withSize: boolean) => (
    <ul className="grid grid-cols-2 items-start gap-x-2 gap-y-3">
      {list.map((template) => (
        <TemplateTile
          key={template.id}
          template={template}
          detail={withSize ? sizeLabel(template) : template.category}
          pending={pendingId === template.id}
          onPick={(mode) => pick(template, mode)}
        />
      ))}
    </ul>
  );

  return (
    <>
      {matching.length > 0 ? (
        <PanelSection title="Templates">
          <p className="text-muted-foreground text-xs">
            Pick one to replace this page or add it on top. Drop a photo onto a
            grey frame to fill it.
          </p>
          {tiles(matching, false)}
        </PanelSection>
      ) : null}
      <PanelSection title={matching.length > 0 ? "Other sizes" : "Templates"}>
        {matching.length > 0 ? null : (
          <p className="text-muted-foreground text-xs">
            None are made for this page&apos;s shape. Replace page also resizes
            the page; Add to page fits the template inside it.
          </p>
        )}
        {tiles(others, true)}
      </PanelSection>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this page?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything on it, locked elements too, and its background make way
              for “{confirming?.name}”. Undo with ⌘Z brings them back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) {
                  apply(confirming, "replace").catch(() => null);
                }
                setConfirming(null);
              }}
            >
              Replace page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
