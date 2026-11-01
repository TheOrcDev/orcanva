// Between character offsets in a text and positions in the editable
// element that shows it (text nodes inside one span per styled run)

export interface TextRange {
  start: number;
  end: number;
}

// Characters before a DOM position, as the text counts them
export const offsetAt = (root: Node, node: Node, offset: number): number => {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
};

// The DOM position of a character offset
export const pointAt = (
  root: Node,
  offset: number
): { node: Node; offset: number } => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let before = 0;
  let last: Text | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (before + text.data.length >= offset) {
      return { node: text, offset: offset - before };
    }
    before += text.data.length;
    last = text;
  }
  return last
    ? { node: last, offset: last.data.length }
    : { node: root, offset: 0 };
};

// The selection inside an element, in characters (start before end)
export const selectionIn = (root: HTMLElement): TextRange | null => {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (
    !(range && root.contains(range.startContainer)) ||
    !root.contains(range.endContainer)
  ) {
    return null;
  }
  const start = offsetAt(root, range.startContainer, range.startOffset);
  const end = offsetAt(root, range.endContainer, range.endOffset);
  return { end: Math.max(start, end), start: Math.min(start, end) };
};

export const selectRange = (root: HTMLElement, range: TextRange) => {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const start = pointAt(root, range.start);
  const end = pointAt(root, range.end);
  const dom = document.createRange();
  dom.setStart(start.node, start.offset);
  dom.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(dom);
};
