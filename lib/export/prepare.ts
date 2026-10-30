import type { DesignDocument } from "@/lib/document/schema";

// Waits until everything the document draws is loaded (fonts, images), so
// exports and thumbnails never capture fallback fonts or missing images.
// Loaders register here as element types that need them are added.
const preparers: ((document: DesignDocument) => Promise<void>)[] = [];

export const registerRenderPreparer = (
  preparer: (document: DesignDocument) => Promise<void>
) => {
  if (!preparers.includes(preparer)) {
    preparers.push(preparer);
  }
};

const nextFrame = (): Promise<undefined> => {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  requestAnimationFrame(() => resolve(undefined));
  return promise;
};

export const prepareForRender = async (
  document: DesignDocument
): Promise<void> => {
  await Promise.all(preparers.map((prepare) => prepare(document)));
  // Let Konva redraw with anything that just finished loading
  await nextFrame();
};
