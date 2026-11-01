// What an image file can carry besides its picture, in the order the tool
// lists what it removed
export const METADATA_KINDS = [
  // C2PA: the signed record of where an image came from, which Instagram,
  // Threads, Facebook, TikTok and LinkedIn read to label it
  "content-credentials",
  // IPTC's "digital source type" saying AI made or edited the image
  "ai-tag",
  // Stable Diffusion, ComfyUI and InvokeAI save the prompt in their PNGs
  "prompt",
  "location",
  "camera",
  "other",
] as const;

export type MetadataKind = (typeof METADATA_KINDS)[number];

// A file with its metadata left out, and what that was
export interface Cleaned {
  bytes: Uint8Array<ArrayBuffer>;
  found: MetadataKind[];
}

export const inListOrder = (found: ReadonlySet<MetadataKind>): MetadataKind[] =>
  METADATA_KINDS.filter((kind) => found.has(kind));

// trainedAlgorithmicMedia, compositeWithTrainedAlgorithmicMedia,
// algorithmicMedia and compositeSynthetic
const AI_SOURCE = /algorithmicmedia|compositesynthetic/iu;
// C2PA can also be linked from XMP rather than embedded
const PROVENANCE = /c2pa|dcterms:provenance/iu;

// Notes the AI labels in XMP and other text metadata
export const noteText = (text: string, found: Set<MetadataKind>): void => {
  if (AI_SOURCE.test(text)) {
    found.add("ai-tag");
  }
  if (PROVENANCE.test(text)) {
    found.add("content-credentials");
  }
};
