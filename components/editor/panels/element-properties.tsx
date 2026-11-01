"use client";

import {
  RiDeleteBinLine,
  RiFileCopyLine,
  RiLockLine,
  RiLockUnlockLine,
} from "@remixicon/react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import {
  ALIGN_ACTIONS,
  ARRANGE_ACTIONS,
} from "@/components/editor/panels/arrange-actions";
import { BoxShapeProperties } from "@/components/editor/panels/box-shape-properties";
import { EffectsProperties } from "@/components/editor/panels/effects-properties";
import { IconAction } from "@/components/editor/panels/icon-action";
import { ImageProperties } from "@/components/editor/panels/image-properties";
import { LineProperties } from "@/components/editor/panels/line-properties";
import { NumberInput } from "@/components/editor/panels/number-input";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TextProperties } from "@/components/editor/panels/text-properties";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { useAlign } from "@/hooks/use-align";
import { useUpdateElement } from "@/hooks/use-selected-element";
import type { DesignElement } from "@/lib/document/schema";
import {
  arrangeElement,
  duplicateElements,
  removeElements,
} from "@/lib/editor/document-ops";
import type { ArrangeDirection } from "@/lib/editor/document-ops";

const TYPE_LABELS: Record<DesignElement["type"], string> = {
  arrow: "Arrow",
  ellipse: "Ellipse",
  image: "Image",
  line: "Line",
  rect: "Rectangle",
  text: "Text",
};

const hasBox = (
  element: DesignElement
): element is Extract<DesignElement, { width: number; height: number }> =>
  element.type === "image" ||
  element.type === "rect" ||
  element.type === "ellipse";

const GeometryFields = ({ element }: { element: DesignElement }) => {
  const update = useUpdateElement(element.id);
  const isLinear = element.type === "line" || element.type === "arrow";

  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberInput
        label="X"
        value={element.x}
        onCommit={(x) => update({ x })}
      />
      <NumberInput
        label="Y"
        value={element.y}
        onCommit={(y) => update({ y })}
      />
      {hasBox(element) ? (
        <>
          <NumberInput
            label="W"
            min={1}
            value={element.width}
            onCommit={(width) => update({ width })}
          />
          <NumberInput
            label="H"
            min={1}
            value={element.height}
            onCommit={(height) => update({ height })}
          />
        </>
      ) : null}
      {element.type === "text" ? (
        <NumberInput
          label="W"
          min={1}
          value={element.width}
          onCommit={(width) => update({ width })}
        />
      ) : null}
      {isLinear ? null : (
        <NumberInput
          label="R"
          suffix="°"
          min={-180}
          max={180}
          value={element.rotation}
          onCommit={(rotation) => update({ rotation })}
        />
      )}
    </div>
  );
};

const TypeProperties = ({ element }: { element: DesignElement }) => {
  switch (element.type) {
    case "rect":
    case "ellipse": {
      return <BoxShapeProperties element={element} />;
    }
    case "image": {
      return <ImageProperties element={element} />;
    }
    case "line":
    case "arrow": {
      return <LineProperties element={element} />;
    }
    case "text": {
      return (
        <>
          <TextProperties element={element} />
          <EffectsProperties element={element} />
        </>
      );
    }
    default: {
      return null;
    }
  }
};

export const ElementProperties = ({ element }: { element: DesignElement }) => {
  const store = useEditorStoreApi();
  const update = useUpdateElement(element.id);
  const { align } = useAlign();

  const arrange = (direction: ArrangeDirection) =>
    store
      .getState()
      .change((doc) => arrangeElement(doc, element.id, direction));

  const duplicate = () => {
    let created: string[] = [];
    store.getState().change((doc) => {
      const result = duplicateElements(doc, [element.id]);
      created = result.ids;
      return result.document;
    });
    store.getState().select(created);
  };

  const remove = () =>
    store.getState().change((doc) => removeElements(doc, [element.id]));

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{element.name}</span>
          <span className="text-muted-foreground text-xs">
            {TYPE_LABELS[element.type]}
            {element.locked ? " · Locked" : ""}
          </span>
        </div>
        <div className="flex gap-1">
          <IconAction
            label={element.locked ? "Unlock" : "Lock"}
            icon={element.locked ? RiLockUnlockLine : RiLockLine}
            onClick={() => update({ locked: !element.locked })}
          />
          <IconAction
            label="Duplicate (⌘D)"
            icon={RiFileCopyLine}
            onClick={duplicate}
            disabled={element.locked}
          />
          <IconAction
            label="Delete (⌫)"
            icon={RiDeleteBinLine}
            onClick={remove}
            disabled={element.locked}
          />
        </div>
      </div>

      <PanelSection title="Arrange">
        <div className="flex gap-1">
          {ARRANGE_ACTIONS.map((action) => (
            <IconAction
              key={action.direction}
              label={`${action.label} (${action.shortcut})`}
              icon={action.icon}
              onClick={() => arrange(action.direction)}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Position">
        <GeometryFields element={element} />
        <div className="flex flex-wrap gap-1">
          {ALIGN_ACTIONS.map((action) => (
            <IconAction
              key={action.edge}
              label={`${action.label} to page`}
              icon={action.icon}
              disabled={element.locked}
              onClick={() => align([element.id], action.edge, "page")}
            />
          ))}
        </div>
      </PanelSection>

      <TypeProperties element={element} />

      <PanelSection title="Layer">
        <TransactionSlider
          label="Opacity"
          value={Math.round(element.opacity * 100)}
          min={0}
          max={100}
          format={(value) => `${value}%`}
          onChange={(value) => update({ opacity: value / 100 })}
        />
      </PanelSection>
    </>
  );
};
