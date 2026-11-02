"use client";

import {
  RiAlignCenter,
  RiAlignLeft,
  RiAlignRight,
  RiBold,
  RiItalic,
  RiStrikethrough,
  RiText,
  RiUnderline,
} from "@remixicon/react";
import { useState } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { ColorPicker } from "@/components/editor/panels/color-picker";
import { FontPicker } from "@/components/editor/panels/font-picker";
import {
  GRADIENT_PRESETS,
  GradientFields,
  twoColorGradient,
} from "@/components/editor/panels/gradient-fields";
import { NumberInput } from "@/components/editor/panels/number-input";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUpdateElement } from "@/hooks/use-selected-element";
import { textAlignSchema } from "@/lib/document/schema";
import type { TextElement } from "@/lib/document/schema";
import { getFont, nearestWeight } from "@/lib/fonts/catalog";
import { rebaseMarks } from "@/lib/text/marks";
import {
  isBold,
  styleText,
  styleValue,
  toggleBold,
  toggleStyle,
} from "@/lib/text/text-style";

// Left to right, across the line
const TEXT_GRADIENT_ANGLE = 90;

const WEIGHT_NAMES: Record<number, string> = {
  100: "Thin",
  200: "Extra light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra bold",
  900: "Black",
};

const ALIGNMENTS = [
  { icon: RiAlignLeft, label: "Align left", value: "left" },
  { icon: RiAlignCenter, label: "Align center", value: "center" },
  { icon: RiAlignRight, label: "Align right", value: "right" },
] as const;

// Updates the canvas on every keystroke; focus → blur is one undo step.
// An emptied field keeps the last non-empty text on the canvas.
const TextContentField = ({ element }: { element: TextElement }) => {
  const store = useEditorStoreApi();
  const update = useUpdateElement(element.id);
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Textarea
      aria-label="Text content"
      rows={3}
      value={draft ?? element.text}
      onFocus={() => store.getState().begin()}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        if (text.trim() !== "") {
          // Styled parts stay on the characters they styled
          update({
            marks: rebaseMarks(element.text, text, element.marks),
            text,
          });
        }
      }}
      onBlur={() => {
        setDraft(null);
        store.getState().end();
      }}
    />
  );
};

export const TextProperties = ({ element }: { element: TextElement }) => {
  const update = useUpdateElement(element.id);
  // While typing with characters selected, the controls style just those
  const range = useEditor((state) => {
    const selection =
      state.editingTextId === element.id ? state.textSelection : null;
    return selection && selection.end > selection.start ? selection : null;
  });
  const shownFontId = styleValue(element, range, "fontId");
  const shownFont = getFont(
    typeof shownFontId === "string" ? shownFontId : element.fontId
  );
  const sizeEm = styleValue(element, range, "sizeEm");
  const shownSize = Math.round(
    element.fontSize * (typeof sizeEm === "number" ? sizeEm : 1)
  );
  // Weights and italic follow the font the selection shows
  const font = shownFont;
  const shownWeight = styleValue(element, range, "weight");
  const weight = nearestWeight(
    font,
    typeof shownWeight === "number" ? shownWeight : element.weight
  );
  const hasBold = font.weights.some((value) => value >= 600);
  const pressed = (key: "italic" | "underline" | "strike") =>
    styleValue(element, range, key) === true;
  const shownFill = styleValue(element, range, "fill");
  const weightItems = font.weights.map((value) => ({
    label: `${WEIGHT_NAMES[value] ?? value} · ${value}`,
    value: String(value),
  }));

  return (
    <>
      <PanelSection title="Text">
        <TextContentField element={element} />
        <FontPicker
          value={shownFont}
          onChange={(next) =>
            update(
              range
                ? styleText(element, range, "fontId", next.id)
                : {
                    ...styleText(element, null, "fontId", next.id),
                    italic: element.italic && next.italic,
                    weight: nearestWeight(next, element.weight),
                  }
            )
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            items={weightItems}
            value={String(weight)}
            onValueChange={(value) =>
              update(styleText(element, range, "weight", Number(value)))
            }
          >
            <SelectTrigger aria-label="Font weight" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {weightItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <NumberInput
            label="Size"
            min={1}
            max={4000}
            value={shownSize}
            onCommit={(size) =>
              // Selected words get a size relative to the text's; the whole
              // text's size keeps words' relative sizes
              update(
                range
                  ? styleText(element, range, "sizeEm", size / element.fontSize)
                  : { fontSize: size }
              )
            }
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[element.align]}
            onValueChange={(value) => {
              const parsed = textAlignSchema.safeParse(value[0]);
              if (parsed.success) {
                update({ align: parsed.data });
              }
            }}
          >
            {ALIGNMENTS.map((alignment) => (
              <ToggleGroupItem
                key={alignment.value}
                value={alignment.value}
                aria-label={alignment.label}
              >
                <alignment.icon />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex gap-1">
            <Toggle
              variant="outline"
              size="sm"
              aria-label="Bold"
              disabled={!hasBold}
              pressed={isBold(shownWeight)}
              onPressedChange={() => update(toggleBold(element, range))}
            >
              <RiBold />
            </Toggle>
            <Toggle
              variant="outline"
              size="sm"
              aria-label="Italic"
              disabled={!font.italic}
              pressed={pressed("italic") && font.italic}
              onPressedChange={() =>
                update(toggleStyle(element, range, "italic"))
              }
            >
              <RiItalic />
            </Toggle>
            <Toggle
              variant="outline"
              size="sm"
              aria-label="Underline"
              pressed={pressed("underline")}
              onPressedChange={() =>
                update(toggleStyle(element, range, "underline"))
              }
            >
              <RiUnderline />
            </Toggle>
            <Toggle
              variant="outline"
              size="sm"
              aria-label="Strikethrough"
              pressed={pressed("strike")}
              onPressedChange={() =>
                update(toggleStyle(element, range, "strike"))
              }
            >
              <RiStrikethrough />
            </Toggle>
            <Toggle
              variant="outline"
              size="sm"
              aria-label="Uppercase"
              pressed={element.uppercase}
              onPressedChange={(uppercase) => update({ uppercase })}
            >
              <RiText />
            </Toggle>
          </div>
        </div>
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[element.fillGradient ? "gradient" : "solid"]}
          onValueChange={(value) => {
            const [fill] = value;
            if (fill === "solid" && element.fillGradient) {
              update({ fillGradient: null });
            }
            if (fill === "gradient" && !element.fillGradient) {
              const [preset] = GRADIENT_PRESETS;
              update({
                fillGradient: twoColorGradient(
                  preset?.from ?? "#ffffff",
                  preset?.to ?? "#000000",
                  TEXT_GRADIENT_ANGLE
                ),
              });
            }
          }}
        >
          <ToggleGroupItem value="solid">Solid</ToggleGroupItem>
          <ToggleGroupItem value="gradient">Gradient</ToggleGroupItem>
        </ToggleGroup>
        {element.fillGradient ? (
          <GradientFields
            value={element.fillGradient}
            onChange={(fillGradient) => update({ fillGradient })}
          />
        ) : (
          <ColorPicker
            label="Text color"
            value={typeof shownFill === "string" ? shownFill : element.fill}
            onChange={(fill) => update(styleText(element, range, "fill", fill))}
          />
        )}
      </PanelSection>
      <PanelSection title="Spacing">
        <TransactionSlider
          label="Line height"
          value={element.lineHeight}
          min={0.6}
          max={2.5}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(lineHeight) => update({ lineHeight })}
        />
        <TransactionSlider
          label="Letter spacing"
          value={element.letterSpacingEm}
          min={-0.1}
          max={0.5}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(letterSpacingEm) => update({ letterSpacingEm })}
        />
      </PanelSection>
    </>
  );
};
