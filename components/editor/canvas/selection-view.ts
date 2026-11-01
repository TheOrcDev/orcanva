import type {
  DesignDocument,
  DesignElement,
  PhotoElement,
  LinearElement,
  TextElement,
} from "@/lib/document/schema";
import { isEditable } from "@/lib/editor/selection";

const isLinear = (element: DesignElement): element is LinearElement =>
  element.type === "line" || element.type === "arrow";

export interface SelectionView {
  // A lone line or arrow gets endpoint handles
  line: LinearElement | undefined;
  // What the selection handles attach to
  transformTargets: DesignElement[];
  // Selected but left out of the handles (locked or hidden ones)
  outlinedIds: string[];
  editingText: TextElement | undefined;
  // An image, or a frame with a photo in it
  cropping: PhotoElement | undefined;
}

// What the canvas draws for the selection and the tools in use. One element
// keeps its handles even when locked; a multi-selection transforms what's
// editable and outlines the rest. Text being typed and an image being
// cropped bring their own tools instead.
export const selectionView = (
  document: DesignDocument,
  selectedIds: readonly string[],
  editingTextId: string | null,
  cropTargetId: string | null
): SelectionView => {
  const find = (id: string | null) =>
    id ? document.elements.find((element) => element.id === id) : undefined;
  const selectedElements = document.elements.filter((element) =>
    selectedIds.includes(element.id)
  );
  const [selected] = selectedElements.length === 1 ? selectedElements : [];
  const editing = find(editingTextId);
  const cropping = find(cropTargetId);
  const busy = (element: DesignElement) =>
    element.id === editingTextId || element.id === cropTargetId;

  let transformTargets: DesignElement[] = [];
  if (selected) {
    transformTargets = isLinear(selected) || busy(selected) ? [] : [selected];
  } else {
    transformTargets = selectedElements.filter(
      (element) => isEditable(element) && !busy(element)
    );
  }

  return {
    cropping:
      cropping?.type === "image" ||
      (cropping?.type === "frame" && cropping.assetId)
        ? cropping
        : undefined,
    editingText: editing?.type === "text" ? editing : undefined,
    line:
      selected && isLinear(selected) && !selected.locked ? selected : undefined,
    outlinedIds:
      selectedElements.length > 1
        ? selectedElements
            .filter((element) => !isEditable(element))
            .map((element) => element.id)
        : [],
    transformTargets,
  };
};
