import type { Size } from "@/lib/document/geometry";
import type { DesignDocument, DesignElement } from "@/lib/document/schema";
import { resizeDocument } from "@/lib/editor/document-ops";
import { freshCopies } from "@/lib/templates/instantiate";

// The Templates tab's two actions, each one document change (one undo
// step). `template` is a template's document as loaded (migrated).

// A template within 1% of the page's shape scales to fit it exactly
export const SHAPE_TOLERANCE = 0.01;

export const sameShape = (a: Size, b: Size): boolean =>
  Math.abs((a.width / a.height) * (b.height / b.width) - 1) <= SHAPE_TOLERANCE;

const moved = <T extends DesignElement>(element: T, dx: number, dy: number) =>
  dx === 0 && dy === 0
    ? element
    : { ...element, x: element.x + dx, y: element.y + dy };

// Everything on the page, locked elements too, and its background give way
// to the template's. A page of the template's shape keeps its size and the
// template scales to it; otherwise the page takes the template's size.
export const replacePage = (
  page: DesignDocument,
  template: DesignDocument
): DesignDocument => {
  const size = sameShape(page, template)
    ? { height: page.height, width: page.width }
    : { height: template.height, width: template.width };
  const fitted = resizeDocument(template, size, true);
  return {
    ...page,
    background: fitted.background,
    elements: freshCopies(fitted.elements),
    height: size.height,
    width: size.width,
  };
};

// The template's elements on top of the page's, with ids of their own:
// scaled to the page when it's the same shape, otherwise scaled to fit
// inside it and centred. The page's size and background stay. Returns the
// new elements' ids too, to select them.
export const addToPage = (
  page: DesignDocument,
  template: DesignDocument
): { document: DesignDocument; ids: string[] } => {
  const scale = Math.min(
    page.width / template.width,
    page.height / template.height
  );
  const size = sameShape(page, template)
    ? { height: page.height, width: page.width }
    : { height: template.height * scale, width: template.width * scale };
  const dx = (page.width - size.width) / 2;
  const dy = (page.height - size.height) / 2;
  const added = freshCopies(
    resizeDocument(template, size, true).elements.map((element) =>
      moved(element, dx, dy)
    )
  );
  return {
    document: { ...page, elements: [...page.elements, ...added] },
    ids: added.map((element) => element.id),
  };
};
