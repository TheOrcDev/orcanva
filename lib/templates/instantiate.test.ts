import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createTextElement,
} from "@/lib/document/factories";
import type { DesignElement } from "@/lib/document/schema";
import {
  initialPositions,
  instantiateTemplate,
} from "@/lib/templates/instantiate";

const PAGE = { height: 720, width: 1280 };

const templateDocument = () => {
  const rect = { ...createBoxElement("rect", PAGE), groupId: "g1", x: 100 };
  const text = { ...createTextElement("heading", PAGE), groupId: "g1" };
  const lone = { ...createBoxElement("ellipse", PAGE), groupId: "g2" };
  return {
    ...createDocument(PAGE),
    elements: [rect, text, lone] as DesignElement[],
  };
};

const ids = (document: { elements: DesignElement[] }) =>
  document.elements.map((element) => element.id);

describe("instantiateTemplate", () => {
  it("gives every element a fresh id", () => {
    const template = templateDocument();
    const first = instantiateTemplate(template);
    const second = instantiateTemplate(template);

    expect(first.elements).toHaveLength(3);
    for (const id of ids(first)) {
      expect(ids(template)).not.toContain(id);
      expect(ids(second)).not.toContain(id);
    }
    expect(first.elements.map((element) => element.name)).toEqual(
      template.elements.map((element) => element.name)
    );
  });

  it("recreates groups, and drops a group of one", () => {
    const [rect, text, lone] = instantiateTemplate(templateDocument()).elements;
    expect(rect?.groupId).toBeTruthy();
    expect(rect?.groupId).not.toBe("g1");
    expect(text?.groupId).toBe(rect?.groupId);
    expect(lone?.groupId).toBeNull();
  });

  it("scales to a size", () => {
    const template = templateDocument();
    const document = instantiateTemplate(template, {
      height: 1080,
      width: 1920,
    });
    expect(document).toMatchObject({ height: 1080, width: 1920 });
    const [rect, text] = document.elements;
    const [sourceRect, sourceText] = template.elements;
    expect(rect?.x).toBeCloseTo((sourceRect?.x ?? 0) * 1.5);
    expect(rect?.type === "rect" && rect.width).toBeCloseTo(
      sourceRect?.type === "rect" ? sourceRect.width * 1.5 : 0
    );
    expect(text?.type === "text" && text.fontSize).toBeCloseTo(
      sourceText?.type === "text" ? sourceText.fontSize * 1.5 : 0
    );
  });

  it("validates the file, filling in fields older files lack", () => {
    expect(() => instantiateTemplate({ elements: "no" })).toThrow();
    const template = templateDocument();
    const {
      curve: _curve,
      marks: _marks,
      ...older
    } = createTextElement("body", PAGE);
    const document = instantiateTemplate({
      ...template,
      elements: [older],
    });
    expect(document.elements[0]).toMatchObject({ curve: 0, marks: [] });
  });
});

describe("initialPositions", () => {
  it("gives sorted keys, one per element", () => {
    const keys = initialPositions(12);
    expect(keys).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
    expect(keys.toSorted()).toEqual(keys);
    expect(initialPositions(0)).toEqual([]);
  });
});
